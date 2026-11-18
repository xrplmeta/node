import http from 'http'
import { expect } from 'chai'
import fetchRaw from 'node-fetch'
import { createFetch, isBlockedAddress, safeLookup, selectAgent } from '../../src/lib/fetch.js'


function lookup(hostname, options = {}){
	return new Promise((resolve, reject) => {
		safeLookup(hostname, options, (error, address, family) => {
			if(error)
				reject(error)
			else
				resolve({ address, family })
		})
	})
}


describe('Fetching: blocking non-public addresses', () => {
	it('blocks loopback, private, link-local and other non-public IPv4 addresses', () => {
		for(let address of [
			'0.0.0.0',
			'127.0.0.1',
			'10.154.5.65',
			'100.64.1.1',
			'169.254.169.254',
			'172.16.0.1',
			'172.31.255.255',
			'192.168.1.1',
			'198.18.0.1',
			'224.0.0.1',
			'255.255.255.255'
		]){
			expect(isBlockedAddress(address), address).to.equal(true)
		}
	})

	it('blocks non-public IPv6 addresses, including IPv4-mapped ones', () => {
		for(let address of [
			'::',
			'::1',
			'::ffff:169.254.169.254',
			'::ffff:127.0.0.1',
			'::ffff:a9fe:a9fe',
			'64:ff9b::a9fe:a9fe',
			'fd00:ec2::254',
			'fc00::1',
			'fe80::1',
			'ff02::1'
		]){
			expect(isBlockedAddress(address), address).to.equal(true)
		}
	})

	it('allows public addresses', () => {
		for(let address of [
			'1.1.1.1',
			'8.8.8.8',
			'54.208.98.161',
			'172.32.0.1',
			'::ffff:8.8.8.8',
			'2606:4700:4700::1111'
		]){
			expect(isBlockedAddress(address), address).to.equal(false)
		}
	})

	it('rejects lookups that resolve to a blocked address', async () => {
		for(let host of ['127.0.0.1', '169.254.169.254', '10.0.0.5', 'localhost']){
			let error = await lookup(host).catch(error => error)

			expect(error, host).to.be.instanceOf(Error)
			expect(error.code, host).to.equal('EBLOCKEDADDRESS')
		}
	})

	it('resolves public addresses in both single and all form', async () => {
		expect(await lookup('8.8.8.8')).to.deep.equal({ address: '8.8.8.8', family: 4 })

		let all = await new Promise((resolve, reject) =>
			safeLookup('8.8.8.8', { all: true }, (error, addresses) => error ? reject(error) : resolve(addresses))
		)

		expect(all).to.deep.equal([{ address: '8.8.8.8', family: 4 }])
	})

	describe('against a server on loopback', () => {
		let server
		let hits = 0

		before(async () => {
			server = http.createServer((req, res) => {
				hits++
				res.end('secret')
			})

			await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
		})

		after(() => server.close())

		for(let host of ['127.0.0.1', 'localhost']){
			it(`refuses to fetch http://${host}:<port>/`, async () => {
				let fetch = createFetch({ timeout: 5 })
				let error = await fetch(`http://${host}:${server.address().port}/`).catch(error => error)

				expect(error).to.be.instanceOf(Error)
				expect(error.code).to.equal('EBLOCKEDADDRESS')
				expect(hits).to.equal(0)
			})
		}
	})

	it('re-checks every redirect hop', async () => {
		let secretHits = 0
		let server = http.createServer((req, res) => {
			if(req.url === '/start'){
				res.writeHead(302, { location: `http://127.0.0.1:${server.address().port}/secret` })
				res.end()
			}else{
				secretHits++
				res.end('secret')
			}
		})

		await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))

		try{
			// stands in for a public first hop: only /start bypasses the guard,
			// the redirect target goes through the same agent selection as createFetch
			let plainAgent = new http.Agent()
			let error = await fetchRaw(
				`http://127.0.0.1:${server.address().port}/start`,
				{ agent: url => url.pathname === '/start' ? plainAgent : selectAgent(url) }
			).catch(error => error)

			expect(error).to.be.instanceOf(Error)
			expect(error.code).to.equal('EBLOCKEDADDRESS')
			expect(secretHits).to.equal(0)
		}finally{
			server.close()
		}
	})
})
