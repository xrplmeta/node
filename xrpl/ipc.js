import EventEmitter from 'events'
import Pool from './pool.js'
import log from '../lib/log.js'


export class Master{
	constructor(config){
		this.pool = new Pool(config)
		this.pool.on('ledger', ledger => this.dispatchEmit('ledger', ledger))
		this.pool.on('transaction', tx => this.dispatchEmit('transaction', tx))
		this.workers = []
	}

	register(worker){
		this.workers.push(worker)

		worker.on('message', ({ type, ...payload }) => {
			if(type === 'xrpl.request'){
				this.pool.request(payload.request)
					.then(res => worker.send({
						type: 'xrpl.request', 
						id: payload.id, 
						...res
					}))
					.catch(res => worker.send({
						type: 'xrpl.request', 
						id: payload.id, 
						...res
					}))
			}
		})
	}

	discard(worker){
		this.workers.splice(this.workers.indexOf(worker), 1)
	}

	request(request){
		return this.pool.request(request)
	}

	dispatchEmit(event, data){
		for(let worker of this.workers){
			worker.send({type: 'xrpl.event', event, data})
		}
	}
}


export class Consumer extends EventEmitter{
	constructor(){
		super()
		
		this.requests = []
		this.counter = 0

		process.on('message', ({type, id, ...payload}) => {
			if(type === 'xrpl.event'){
				this.emit(payload.event, payload.data)
			}else if(type === 'xrpl.request'){
				let req = this.requests.find(r => r.id === id)

				if(req){
					this.requests.splice(this.requests.indexOf(req), 1)

					if(payload.result)
						req.resolve(payload)
					else
						req.reject(payload)
				}
			}
		})
	}

	async request(request){
		return await new Promise((resolve, reject) => {
			let id = this.counter++

			this.requests.push({id, resolve, reject})
			process.send({type: 'xrpl.request', id, request})
		})
	}
}