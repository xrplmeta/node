import log from '../../lib/log.js'
import { wait } from '@xrplworks/time'

export default async function({ ctx, ledgerIndex, marker }){
	let chunkSize = config.ledger.snapshot.chunkSize || 10000
	let queue = []
	let { result, node: assignedNode } = await xrpl.request({
		type: 'reserveTicket',
		task: 'snapshot',
		ledgerIndex,
		node: marker?.node
	})
	
	log.info(`reserved ledger snapshot ticket (${result.ticket}) with node ${assignedNode}`)

	let ledgerIndex = ledgerIndex
	let ticket = result.ticket
	let ongoing = true
	let failures = 0
	let promise = (async() => {
		while(true){
			while(this.queue.length >= this.chunkSize * 10)
				await wait(100)

			try{
				let { result } = await this.xrpl.request({
					command: 'ledger_data',
					ledger_index: this.ledgerIndex,
					marker: this.marker?.ledger,
					limit: this.chunkSize,
					ticket: this.ticket
				})

				this.queue.push(...result.state)
				this.marker.ledger = result.marker

				failures = 0
			}catch(e){
				if(++failures >= 10){
					break
				}

				log.info(`could not fetch ledger chunk:`, e)
				await wait(2500)
				continue
			}

			if(!this.marker.ledger){
				this.complete = true
				break
			}
		}

		this.ongoing = false
	})()

	return {

	}
}