import { log } from '../lib/logging.js'
import * as procedures from './procedures.js'


export default class{
	constructor(ctx){
		this.ctx = ctx
		this.clients = []
		this.counter = 0
		this.log = log.for('server.ws', 'green')
	}

	register(socket){
		 let client = {
			id: ++this.counter,
			socket, 
			//ip: request.socket.remoteAddress
		}

		socket.on('message', async message => {
			try{
				var request = JSON.parse(message)
			}catch{
				this.log(`client #${client.id} sent malformed request - dropping them`)
				socket.close()
			}

			try{
				let data = await this.serveRequest(client, request.payload)

				socket.send(JSON.stringify({request: request.id, data}))
			}catch(error){
				let response = null

				if(typeof error === 'object'){
					if(error.expose)
						response = error
				}

				if(!response){
					this.log(`internal server error while serving client #${client.id}: ${error}`)
					response = {message: 'internal server error'}
				}

				socket.send(JSON.stringify({request: request.id, error: response}))
			}
		})

		socket.on('close', () => {
			this.clients.splice(this.clients.indexOf(client))
			this.log(`client #${client.id} disconnected`)
		})

		this.clients.push(client)
		this.log(`new connection (#${client.id})`)
	}

	async serveRequest(client, request){
		if(!procedures[request.command]){
			throw {message: 'unknown command', expose: true}
		}

		return await procedures[request.command]({
			...this.ctx,
			parameters: request
		})
	}
}