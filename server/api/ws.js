import log from '@xrplmeta/log'
import * as procedures from './procedures.js'


const keepAliveInterval = 10000


export default class{
	constructor(ctx){
		this.ctx = ctx
		this.clients = []
		this.counter = 0

		setInterval(() => this.ping(), keepAliveInterval)
	}

	register(socket){
		 let client = {
			id: ++this.counter,
			socket, 
			subscriptions: [],
			alive: true
		}

		socket.on('message', async message => {
			try{
				var request = JSON.parse(message)
			}catch{
				log.info(`client #${client.id} sent malformed request - dropping them`)
				socket.close()
			}

			try{
				if(request.command === 'subscribe'){
					socket.send(JSON.stringify({
						result: await this.subscribe(client, request),
						id: request.id, 
					}))
				}else{
					socket.send(JSON.stringify({
						result: await this.serveRequest(client, request),
						id: request.id, 
					}))
				}
			}catch(error){
				let response = null

				if(typeof error === 'object'){
					if(error.expose)
						response = error
				}

				if(!response){
					log.info(`internal server error while serving client #${client.id}:`, error)
					response = {message: 'internal server error'}
				}

				socket.send(JSON.stringify({id: request.id, error: response}))
			}
		})

		socket.on('pong', () => {
			client.alive = true
		})

		socket.on('close', () => {
			this.clients.splice(this.clients.indexOf(client))
			log.info(`client #${client.id} disconnected`)
		})

		this.clients.push(client)
		log.info(`new connection (#${client.id})`)
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

	async subscribe(client, request){
		
	}

	ping(){
		for(let client of this.clients){
			if(!client.alive){
				client.socket.close()
				log.info(`client #${client.id} inactivity kick`)
				continue
			}

			client.alive = false
			client.socket.ping()
		}
	}
}