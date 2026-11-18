import { expect } from 'chai'
import { WebSocketServer } from 'ws'
import Node from '../../src/xrpl/node.js'


// Minimal rippled stand-in: refuses the first subscribe with tooBusy,
// accepts later ones and then pushes a closed ledger.
async function createFakeRippled(){
	let server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
	let state = { connections: 0, sockets: [] }

	await new Promise(resolve => server.on('listening', resolve))

	server.on('connection', socket => {
		let connection = ++state.connections

		state.sockets.push(socket)

		socket.on('message', raw => {
			let { id, command } = JSON.parse(raw)

			if(command !== 'subscribe')
				return

			if(connection === 1){
				socket.send(JSON.stringify({
					id,
					type: 'response',
					status: 'error',
					error: 'tooBusy',
					error_code: 9,
					error_message: 'The server is too busy to help you now.'
				}))
				return
			}

			socket.send(JSON.stringify({ id, type: 'response', status: 'success', result: {} }))
			socket.send(JSON.stringify({
				type: 'ledgerClosed',
				ledger_index: 100,
				ledger_hash: '64'.padStart(64, '0'),
				txn_count: 0,
				validated_ledgers: '1-100'
			}))
		})
	})

	return {
		state,
		url: `ws://127.0.0.1:${server.address().port}`,
		close(){
			for(let socket of state.sockets)
				socket.terminate()

			server.close()
		}
	}
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))


describe('XRPL node: failed subscribe', function(){
	this.timeout(30000)

	let rippled
	let node

	afterEach(() => {
		node?.disconnect()
		rippled?.close()
	})

	it('reconnects after the delay and resubscribes when the subscribe request is refused', async () => {
		rippled = await createFakeRippled()
		node = new Node({ url: rippled.url })
		node.on('error', () => {})

		// still on the refused connection during the 10s delay
		await wait(5000)

		expect(rippled.state.connections).to.equal(1)
		expect(node.hasReportedClosedLedger).to.equal(false)

		// after the delay (+1s library reconnect delay) it has resubscribed
		await wait(8000)

		expect(rippled.state.connections).to.equal(2)
		expect(node.hasReportedClosedLedger).to.equal(true)
	})
})
