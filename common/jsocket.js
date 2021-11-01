import { wait } from './utils.js'

export default class{
	constructor(websocketClass){
		this.whenReady = new Promise(resolve => this.nowReady = resolve)
		this.websocketClass = websocketClass || window.WebSocket
	}

	async request(type, data){
		await this.whenReady

		let id = ++this.requestCounter
		let message = {type, data, id}

		return new Promise((resolve, reject) => {
			this.requestRegistry.push({id, resolve, reject})
			this.socket.send(JSON.stringify(message))
		})
	}

	connect(url){
		this.url = url
		this.keepConnecting()
	}


	async keepConnecting(){
		while(true){
			try{
				await this.createSocketConnection()
				this.nowReady()
				break
			}catch(error){
				await wait(1000)
			}
		}
	}


	async createSocketConnection(){
		await new Promise(async (resolve, reject) => {
			this.socket = new this.websocketClass(this.url)

			this.socket.addEventListener('open', () => {
				this.connected = true
				this.requestCounter = 0
				this.requestRegistry = []

				this.socket.addEventListener('message', event => {
					let payload = JSON.parse(event.data)

					if(payload.request){
						let handlerIndex = this.requestRegistry.findIndex(({id}) => id === payload.request)

						if(handlerIndex >= 0){
							let handler = this.requestRegistry[handlerIndex]

							if(payload.error){
								handler.reject(payload.error)
							}else{
								handler.resolve(payload.data)
							}

							this.requestRegistry.splice(handlerIndex, 1)
						}
					}
				})

				this.socket.addEventListener('close', async () => {
					this.whenReady = new Promise(resolve => this.nowReady = resolve)

					await wait(1000)
					await this.keepConnecting()
				})

				resolve()
			})


			this.socket.addEventListener('error', error => {
				this.connectionError = error
				reject(error)
			})
		})
	}

	isConnected(){
		return this.socket && this.socket.readyState === 1
	}
}