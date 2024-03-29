import { RateLimiter } from 'limiter'
import { sanitize } from './url.js'
import { AbortController } from 'node-abort-controller'
import fetch from 'node-fetch'


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