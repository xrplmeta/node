import log from '@mwni/log'
import { wait } from '@xrplkit/time'

export async function start({ ctx, ledgerSequence }){
	let chunkSize = ctx.config.ledger.snapshotChunkSize || 10000
	let marker = ctx.snapshotState?.marker
	let queue = []
	
	let { result, node: assignedNode } = await ctx.xrpl.request({
		type: 'reserveTicket',
		task: 'snapshot',
		ledgerSequence,
		node: ctx.snapshotState?.originNode
	})

	let ticket = result.ticket
	let fetching = true
	let failures = 0
	let resolveNext

	let promise = (async() => {
		while(true){
			while(queue.length >= 10)
				await wait(100)

			try{
				let { result } = await ctx.xrpl.request({
					command: 'ledger_data',
					ledger_index: ledgerSequence,
					limit: chunkSize,
					marker,
					ticket
				})

				queue.push({ 
					objects: result.state, 
					marker: result.marker 
				})

				marker = result.marker
				failures = 0

				if(resolveNext)
					resolveNext()
					
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
				fetching = false
				break
			}
		}
	})()

	return {
		ledgerSequence,
		node: assignedNode,
		async next(){
			if(queue.length > 0)
				return queue.shift()

			if(!fetching)
				return

			await new Promise(resolve => resolveNext = resolve)

			return queue.shift()
		}
	}
}