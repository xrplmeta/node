import log from '@mwni/log'
import { wait } from '@xrplkit/time'

export async function start({ ctx, ledgerSequence, marker, node }){
	if(ctx.log)
		log.pipe(ctx.log)

	let chunkSize = ctx.config.node.snapshotChunkSize || 10000
	let queue = []
	
	let { result, node: assignedNode } = await ctx.xrpl.request({
		type: 'reserveTicket',
		task: 'snapshot',
		ledgerSequence,
		node
	})

	let ticket = result.ticket
	let fetching = true
	let resolveNext

	log.info(`reserved snapshot ticket with node`, assignedNode)

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

				if(resolveNext)
					resolveNext()
					
			}catch(e){
				log.info(`could not fetch ledger chunk:`, e.error ? e.error : e)
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