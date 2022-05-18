import log from '@mwni/log'
import { wait } from '@xrplworks/time'

export default async function({ config, xrpl, ledgerIndex, preferredNode, marker }){
	let chunkSize = config.ledger.snapshotChunkSize || 10000
	let queue = []
	let { result, node: assignedNode } = await xrpl.request({
		type: 'reserveTicket',
		task: 'snapshot',
		ledgerIndex,
		node: preferredNode
	})
	
	log.info(`reserved ledger snapshot ticket (${result.ticket}) with node ${assignedNode}`)

	let ticket = result.ticket
	let done = false
	let failures = 0
	let promise = (async() => {
		while(true){
			while(queue.length >= chunkSize * 10)
				await wait(100)

			try{
				let { result } = await xrpl.request({
					command: 'ledger_data',
					ledger_index: ledgerIndex,
					limit: chunkSize,
					marker,
					ticket
				})

				queue.push(...result.state)
				marker = result.marker
				failures = 0
			}catch(e){
				if(++failures >= 10){
					throw e
					break
				}

				log.info(`could not fetch ledger chunk:`, e)
				await wait(2500)
				continue
			}

			if(!marker){
				done = true
				break
			}
		}
	})()

	return {
		get node(){
			return assignedNode
		},
		get queue(){
			return queue
		},
		get marker(){
			return marker
		},
		get done(){
			return done
		}
	}
}