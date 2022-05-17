import EventEmitter from 'events'
import log from '@mwni/log'
import { wait } from '@xrplworks/time'
import Node from './node.js'


export default function(sources){
	let events = new EventEmitter
	let seenHashes = []
	let queue = []
	let nodes = []

	
	async function workQueue(){
		while(true){
			for(let i=0; i<queue.length; i++){
				let request = queue[i]
				let [ bestBid ] = nodes
					.map(node => ({node, bid: node.bid(request.payload)}))
					.sort((a, b) => b.bid - a.bid)

				if(bestBid.bid <= 0)
					continue

				request.accepted()
			
				bestBid.node.do(request.payload)
					.then(result => request.resolve({result, node: bestBid.node.name}))
					.catch(error => request.reject({error, node: bestBid.node.name}))

				queue.splice(i--, 1)
			}

			await wait(100)
		}
	}

	function sawHash(hash){
		if(seenHashes.includes(hash))
			return true

		seenHashes.push(hash)

		if(seenHashes.length > 10000)
			seenHashes.shift()
	}


	log.info(`using nodes:`)

	for(let spec of sources){
		let connections = spec.connections || 1

		for(let i=0; i<connections; i++){
			let node = new Node(spec)

			node.on('event', ({ hash, tx, ledger }) => {
				if(sawHash(hash))
					return

				if(tx)
					events.emit('tx', tx)

				if(ledger)
					events.emit('ledger', ledger)
			})

			nodes.push(node)
		}

		log.info(` - ${spec.url}`)
	}

	workQueue()

	return Object.assign(
		events,
		{
			request(payload){
				return new Promise((resolve, reject) => {
					let timeout = setTimeout(() => reject('unfulfillable'), 30000)
					let accepted = () => clearTimeout(timeout)
		
					queue.push({
						payload,
						resolve,
						reject,
						accepted
					})
				})
			}
		}
	)
}