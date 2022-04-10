import { wait, unixNow } from '@xrplworks/time'
import log from '../lib/log.js'


let repo
let xrpl

export function setContext(ctx){
	repo = ctx.repo
	xrpl = ctx.xrpl
}


export async function scheduleTimeRoutine({ id, interval, forEvery, routine }){
	while(true){
		let now = unixNow()

		if(forEvery){
			let subject = {account: 'A', token: 'T'}[forEvery]
			let operation = await repo.operations.getNext(id, subject)


			if(!operation || (operation.result === 'success' && operation.start + interval > now)){
				log.debug('wait')
				await wait(1000)
				continue
			}

			await repo.operations.record(
				id, 
				`${subject}${operation.entity}`, 
				routine(now, operation.entity)
			)
		}else{
			let recent = await repo.operations.getMostRecent(id)

			if(recent && recent.result === 'success' && recent.start + interval > now){
				await wait(1000)
				continue
			}

			await repo.operations.record(
				id, 
				null, 
				routine(now)
			)
		}
	}
}

export async function scheduleLedgerRoutine({ id, interval, routine }){
	while(true){
		try{
			let { ledger } = await xrpl.request({command: 'ledger', ledger_index: 'validated'})
			let now = ledger.ledger_index
			let head = Math.floor(now / interval.live) * interval.live
			let covered = await repo.ledgerDiscovery.get(id, head)
			let chosen = head

			while(covered){
				let oneBefore = covered.tail - 1
				
				chosen = Math.floor(oneBefore / interval.backfill) * interval.backfill
				covered = await repo.ledgerDiscovery.get(id, chosen)
			}

			await routine(chosen, chosen < head)
			await repo.ledgerDiscovery.extend(id, chosen)
		}catch(e){
			log.info(`ledger routine "${id}" failed:\n`, e)
			await wait(3000)
		}
	}
}