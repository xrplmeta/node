import EventEmitter from 'events'
import Socket from '@xrplworks/socket'
import { wait } from '@xrplworks/time'
import log from '../lib/log.js'
import Node from './node.js'


export default class Pool extends EventEmitter{
	constructor({ config }){
		super()

		this.log = log.branch({name: 'xrpl', color: 'yellow'})
		this.seenHashes = []
		this.queue = []
		this.nodes = []

		for(let spec of config.sources){
			let connections = spec.connections || 1

			for(let i=0; i<connections; i++){
				let node = new Node(spec)

				node.on('event', ({ hash, tx, ledger }) => {
					if(this.sawHash(hash))
						return

					if(tx)
						this.emit('tx', tx)

					if(ledger)
						this.emit('ledger', ledger)
				})

				this.nodes.push(node)
			}
		}

		this.workQueue()
	}

	async workQueue(){
		while(true){
			for(let i=0; i<this.queue.length; i++){
				let request = this.queue[i]
				let [ bestBid ] = this.nodes
					.map(node => ({node, bid: node.bid(request.payload)}))
					.sort((a, b) => b.bid - a.bid)

				if(bestBid.bid <= 0)
					continue

				request.accepted()
			
				bestBid.node.do(request.payload)
					.then(result => request.resolve({result, node: bestBid.node.name}))
					.catch(error => request.reject({error, node: bestBid.node.name}))

				this.queue.splice(i--, 1)
			}

			await wait(100)
		}
	}

	request(payload){
		return new Promise((resolve, reject) => {
			let timeout = setTimeout(() => reject('unfulfillable'), 30000)
			let accepted = () => clearTimeout(timeout)

			this.queue.push({
				payload,
				resolve,
				reject,
				accepted
			})
		})
	}

	sawHash(hash){
		if(this.seenHashes.includes(hash))
			return true

		this.seenHashes.push(hash)

		if(this.seenHashes.length > 10000)
			this.seenHashes.shift()
	}
}