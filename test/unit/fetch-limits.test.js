import http from 'http'
import { expect } from 'chai'
import { createFetch } from '../../src/lib/fetch.js'


const agent = new http.Agent()

let server
let baseUrl
let timers = []

function route(req, res){
	switch(req.url){
		case '/small':
			res.writeHead(200, { 'content-type': 'text/plain' })
			res.end('it works')
			break

		case '/drip': {
			res.writeHead(200, { 'content-type': 'text/plain' })
			let timer = setInterval(() => res.write('x'), 100)
			timers.push(timer)
			req.on('close', () => clearInterval(timer))
			break
		}

		case '/huge': {
			let chunk = Buffer.alloc(64 * 1024, 'x')
			res.writeHead(200, { 'content-type': 'text/plain' })
			let push = () => {
				while(res.write(chunk));
				res.once('drain', push)
			}
			req.on('close', () => res.removeAllListeners('drain'))
			push()
			break
		}

		case '/huge.png': {
			let chunk = Buffer.alloc(64 * 1024, 0)
			res.writeHead(200, { 'content-type': 'image/png' })
			let push = () => {
				while(res.write(chunk));
				res.once('drain', push)
			}
			req.on('close', () => res.removeAllListeners('drain'))
			push()
			break
		}
	}
}


describe('Fetching: timeout and size limits', function(){
	this.timeout(15000)

	before(async () => {
		server = http.createServer(route)
		await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
		baseUrl = `http://127.0.0.1:${server.address().port}`
	})

	after(() => {
		timers.forEach(clearInterval)
		server.closeAllConnections?.()
		server.close()
	})

	it('reads a small response normally', async () => {
		let fetch = createFetch({ agent, timeout: 5, maxSize: 1024 })
		let { status, data } = await fetch(`${baseUrl}/small`)

		expect(status).to.equal(200)
		expect(data).to.equal('it works')
	})

	it('aborts a body that keeps dripping past the timeout', async () => {
		let fetch = createFetch({ agent, timeout: 1 })
		let started = Date.now()
		let error = await fetch(`${baseUrl}/drip`).catch(error => error)

		expect(error).to.be.instanceOf(Error)
		expect(error.name).to.equal('AbortError')
		expect(Date.now() - started).to.be.below(5000)
	})

	it('aborts a body that grows past the size cap', async () => {
		let fetch = createFetch({ agent, timeout: 10, maxSize: 1024 * 1024 })
		let error = await fetch(`${baseUrl}/huge`).catch(error => error)

		expect(error).to.be.instanceOf(Error)
		expect(error.type).to.equal('max-size')
	})

	it('applies the size cap to raw responses read by the caller', async () => {
		let fetch = createFetch({ agent, timeout: 10, maxSize: 1024 * 1024 })
		let res = await fetch(`${baseUrl}/huge.png`, { raw: true })
		let error = await res.arrayBuffer().catch(error => error)

		expect(error).to.be.instanceOf(Error)
		expect(error.type).to.equal('max-size')
	})

	it('applies the timeout to raw responses read by the caller', async () => {
		let fetch = createFetch({ agent, timeout: 1 })
		let res = await fetch(`${baseUrl}/drip`, { raw: true })
		let error = await res.arrayBuffer().catch(error => error)

		expect(error).to.be.instanceOf(Error)
		expect(error.name).to.equal('AbortError')
	})
})
