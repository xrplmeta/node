import xrpl from 'xrpl'
import { wait } from '../../common/time.js'
import { log } from '../../common/logging.js'


export default class{
	constructor(nodes){
		this.log = log.for('nodes', 'yellow')
		this.queue = []
		this.clients = []

		for(let node of nodes){
			if(node.disabled)
				continue

			let client = new xrpl.Client(node.url, {timeout: 60000})

			//yes
			client.nodeConfig = node

			this.clients.push(client)
			this.loop(client)
		}
	}

	async loop(client){
		await this.ensureConnected(client)

		while(true){
			let job = null

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
				await this.ensureConnected(client)

				let { result } = await client.request(job.request)

				job.resolve(result)
			}catch(error){
				job.reject(error)
			}
		}
	}

	request(request){
		return new Promise((resolve, reject) => {
			this.queue.push({request, resolve, reject})
		})
	}

	async ensureConnected(client){
		while(!client.isConnected()){
			try{
				await client.connect()
				this.printConnections(`${client.nodeConfig.url} established`)
			}catch(error){
				this.printConnections(`${client.nodeConfig.url} lost: ${error.message}`)
				await wait(3000)
			}
		}
	}

	printConnections(recent){
		let online = this.clients.filter(client => client.isConnected()).length

		this.log(`${online} / ${this.clients.length} clients online ${recent ? `(${recent})` : ''}`)
	}
}