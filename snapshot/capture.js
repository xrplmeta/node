import log from '../lib/log.js'
import { wait } from '@xrplworks/time'


export default class{
	constructor({ ledgerIndex, config, xrpl }){
		this.chunkSize = config.ledger.snapshot.chunkSize || 10000
		this.xrpl = xrpl
		this.queue = []
	}

	async start({ ledgerIndex, marker, node }){
		let { result, node: assignedNode } = await this.xrpl.request({
			type: 'reserveTicket',
			task: 'snapshot',
			ledgerIndex,
			node
		})
		
		log.info(`reserved ledger snapshot ticket (${result.ticket}) with node ${assignedNode}`)

		this.ledgerIndex = ledgerIndex
		this.marker = marker
		this.ticket = result.ticket
		this.assignedNode = assignedNode
		this.ongoing = true
		this.fill()
	}

	async fill(){
		let failures = 0

		while(true){
			while(this.queue.length >= this.chunkSize * 10)
				await wait(100)

			try{
				let { result } = await this.xrpl.request({
					command: 'ledger_data',
					ledger_index: this.ledgerIndex,
					marker: this.marker,
					limit: this.chunkSize,
					ticket: this.ticket
				})

				this.queue.push(...result.state)
				this.marker = result.marker

				failures = 0
			}catch(e){
				if(++failures >= 10){
					break
				}

				log.info(`could not fetch ledger chunk:`, e)
				await wait(2500)
				continue
			}

			if(!this.marker){
				this.complete = true
				break
			}
		}

		this.ongoing = false
	}
}