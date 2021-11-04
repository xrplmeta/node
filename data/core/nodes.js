import xrpl from 'xrpl'
import EventEmitter from '../../common/events.js'
import { wait } from '../../common/time.js'
import { log } from '../../common/logging.js'


export default class extends EventEmitter{
	constructor(config){
		super()

		this.log = log.for('nodes', 'yellow')
		this.queue = []
		this.clients = []

		for(let node of config.nodes){
			if(node.disabled)
				continue

			let connections = node.connections || 1

			for(let i=0; i<connections; i++){
				let client = new xrpl.Client(node.url, {timeout: 60000})

				//yes
				client.nodeConfig = node
				client.on('transaction', tx => this.emit('transaction', tx))
				client.on('ledgerClosed', ledger => this.emit('ledger', ledger))
				client.on('connected', () => {
					this.printConnections(`${client.nodeConfig.url} established`)

					if(node.subscribable){
						this.subscribeClient(client)
					}
				})
				client.on('disconnected', async code => {
					this.printConnections(`${client.nodeConfig.url} disconnected (code ${code})`)
					this.connectClient(client)
				})
				

				this.clients.push(client)
				this.connectClient(client)
				this.loop(client)
			}
		}
	}




	async loop(client){
		while(true){
			let job = null

			while(!client.isConnected()){
				await wait(100)
				continue
			}

			for(let i=0; i<this.queue.length; i++){
				let item = this.queue[i]

				if(item.request.command === 'ledger_data' && !client.nodeConfig.scannable)
					continue

				job = this.queue.splice(i, 1)[0]
				break
			}

			if(!job){
				await wait(250)
				continue
			}

			try{
				let { result } = await client.request(job.request)

				job.resolve(result)
			}catch(error){
				job.reject(error)
			}
		}
	}

	request({priority, ...request}){
		priority = priority || 0

		return new Promise((resolve, reject) => {
			let insertAt = this.queue.length - 1

			while(insertAt > 0 && priority > this.queue[insertAt].priority){
				insertAt--
			}

			this.queue.splice(insertAt, 0, {priority, request, resolve, reject})
		})
	}

	async getCurrentLedger(){
		let result = await this.request({command: 'ledger'})

		return result.ledger || result.closed.ledger
	}

	async subscribeClient(client){
		let result = await this.request({
			command: 'subscribe',
			streams: ['ledger', 'transactions']
		})
	}

	async connectClient(client){
		while(!client.isConnected()){
			try{
				await client.connect()
			}catch(error){
				await wait(3000)
			}
		}
	}

	printConnections(recent){
		let online = this.clients.filter(client => client.isConnected()).length

		this.log(`${online} / ${this.clients.length} clients online ${recent ? `(${recent})` : ''}`)
	}
}