import log from '@mwni/log'
import * as procedures from './api.js'


const checkAliveInterval = 10000


export function createManager({ ctx }){
	let clients = []
	let counter = 0

	setInterval(
		() => {
			for(let client of clients){
				if(!client.alive){
					client.socket.close()
					log.info(`client #${client.id} inactivity kick`)
					continue
				}
	
				client.alive = false
				client.socket.ping()
			}
		},
		checkAliveInterval
	)

	async function serve(client, { command, ...params }){
		if(!procedures[command]){
			throw {message: 'unknown command', expose: true}
		}

		return await procedures[command]({
			ctx,
			...params
		})
	}

	async function subscribe(){

	}

	return {
		registerSocket(socket){
			let client = {
				id: ++counter,
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
						socket.send(
							JSON.stringify({
								result: await subscribe(client, request),
								id: request.id, 
							})
						)
					}else{
						socket.send(
							JSON.stringify({
								result: await serve(client, request),
								id: request.id, 
							})
						)
					}
				}catch(error){
					let response = null
	
					if(typeof error === 'object'){
						if(error.expose)
							response = error
					}
	
					if(!response){
						log.info(`internal server error while serving client #${client.id}:`, error.message)
						response = {message: 'internal server error'}
					}
	
					socket.send(
						JSON.stringify({
							id: request.id, 
							error: response
						})
					)
				}
			})
	
			socket.on('pong', () => {
				client.alive = true
			})
	
			socket.on('close', () => {
				clients.splice(clients.indexOf(client))
				log.info(`client #${client.id} disconnected`)
			})
	
			clients.push(client)
			log.info(`new connection (#${client.id})`)
		}
	}
}