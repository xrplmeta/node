import dns from 'dns'
import http from 'http'
import https from 'https'
import net from 'net'
import { RateLimiter } from 'limiter'
import { sanitize } from './url.js'
import { AbortController } from 'node-abort-controller'
import fetch from 'node-fetch'


// Outbound requests must not reach loopback, private, link-local (incl. the
// AWS metadata service) or other non-public addresses. The check runs on the
// resolved IP when each connection is opened, so it also covers hostnames
// that resolve to such addresses and every redirect hop.
// IPv4 and IPv6 use separate lists: a BlockList also matches IPv4 addresses
// against IPv4-mapped IPv6 rules, so mixing them would block all of IPv4.
const blockedIPv4 = new net.BlockList()
const blockedIPv6 = new net.BlockList()

for(let [prefix, bits] of [
	['0.0.0.0', 8],
	['10.0.0.0', 8],
	['100.64.0.0', 10],
	['127.0.0.0', 8],
	['169.254.0.0', 16],
	['172.16.0.0', 12],
	['192.0.0.0', 24],
	['192.168.0.0', 16],
	['198.18.0.0', 15],
	['224.0.0.0', 4],
	['240.0.0.0', 4]
]){
	blockedIPv4.addSubnet(prefix, bits, 'ipv4')
}

for(let [prefix, bits] of [
	['::', 128],
	['::1', 128],
	['64:ff9b::', 96],
	['fc00::', 7],
	['fe80::', 10],
	['ff00::', 8]
]){
	blockedIPv6.addSubnet(prefix, bits, 'ipv6')
}

export function isBlockedAddress(address){
	if(net.isIPv4(address))
		return blockedIPv4.check(address, 'ipv4')

	if(!net.isIPv6(address))
		return true

	let mapped = mappedIPv4(address)

	if(mapped)
		return blockedIPv4.check(mapped, 'ipv4')

	return blockedIPv6.check(address, 'ipv6')
}

// ::ffff:a.b.c.d / ::ffff:xxxx:xxxx -> a.b.c.d, else undefined
function mappedIPv4(address){
	let normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1)
	let match = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)

	if(!match)
		return

	let high = parseInt(match[1], 16)
	let low = parseInt(match[2], 16)

	return [high >> 8, high & 255, low >> 8, low & 255].join('.')
}

export function safeLookup(hostname, options, callback){
	if(typeof options === 'function'){
		callback = options
		options = {}
	}else if(typeof options === 'number'){
		options = { family: options }
	}

	dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
		if(error)
			return callback(error)

		let blocked = addresses.find(({ address }) => isBlockedAddress(address))

		if(blocked){
			return callback(Object.assign(
				new Error(`blocked request to non-public address ${blocked.address} (${hostname})`),
				{ code: 'EBLOCKEDADDRESS' }
			))
		}

		if(options.all)
			callback(null, addresses)
		else
			callback(null, addresses[0].address, addresses[0].family)
	})
}

// Hostnames are checked in safeLookup. IP-literal hosts (http://10.0.0.5/)
// connect without a DNS lookup, so they are checked here.
function guardAgent(Agent){
	return class extends Agent {
		createConnection(options, callback){
			let host = (options.host || '').replace(/^\[|\]$/g, '')

			if(net.isIP(host) && isBlockedAddress(host)){
				callback(Object.assign(
					new Error(`blocked request to non-public address ${host}`),
					{ code: 'EBLOCKEDADDRESS' }
				))
				return
			}

			return super.createConnection(options, callback)
		}
	}
}

const httpAgent = new (guardAgent(http.Agent))({ lookup: safeLookup })
const httpsAgent = new (guardAgent(https.Agent))({ lookup: safeLookup })
export const selectAgent = url => url.protocol === 'http:' ? httpAgent : httpsAgent


export function createFetch({ baseUrl, headers, ratelimit, timeout = 20 } = {}){
	let limiter = ratelimit 
		? new RateLimiter({
			tokensPerInterval: ratelimit, 
			interval: 'minute'
		}) 
		: null

	return async (url = '', options = {}) => {
		if(limiter)
			await limiter.removeTokens(1)
		
		let res
		let data
		let controller = new AbortController()
		let timeoutTimer = setTimeout(() => controller.abort(), timeout * 1000)
		let sanitizedUrl = sanitize(baseUrl ? `${baseUrl}/${url}` : url)

		try{
			res = await fetch(
				sanitizedUrl,
				{
					agent: selectAgent,
					signal: controller.signal,
					headers: {
						'user-agent': 'XRPL-Meta-Node (https://xrplmeta.org)',
						...headers,
						...options.headers
					}
				}
			)
		}catch(error){
			res?.blob()?.catch(() => null)
			throw error
		}finally{
			clearTimeout(timeoutTimer)
		}

		if(options.raw){
			return res
		}

		try{
			if(res.headers.get('content-type')?.includes('application/json')){
				data = await res.json()
			}else if(res.headers.get('content-type')?.match(/(image\/|video\/|application\/octet-stream)/)){
				data = Buffer.from(await res.arrayBuffer())
			}else{
				data = await res.text()
			}
		}catch{
			data = null
		}

		return { 
			status: res.status,
			headers: res.headers,
			data
		}
	}
}