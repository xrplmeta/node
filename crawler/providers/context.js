import fetch from 'node-fetch'
import Rest from '../lib/rest.js'
import { wait, unixNow } from '@xrplmeta/common/lib/time.js'
import { log } from '@xrplmeta/common/lib/log.js'


const leeway = 1


export default ({config, repo, xrpl}) => ({
	config,
	repo,
	xrpl,
	loopLedgerTask: async (specs, task) => {
		while(true){
			try{
				let { ledger, closed } = await xrpl.request({command: 'ledger'})
				let now = ledger?.ledger_index || closed?.ledger.ledger_index - leeway
				let head = Math.floor(now / specs.interval) * specs.interval
				let covered = await repo.coverages.get(specs.task, head)
				let chosen = head

				while(covered){
					let oneBefore = covered.tail - 1
					
					chosen = Math.floor(oneBefore / specs.backfillInterval) * specs.backfillInterval
					covered = await repo.coverages.get(specs.task, chosen)
				}

				await task(chosen, chosen < head)
				await repo.coverages.extend(specs.task, chosen)
			}catch(e){
				log.info(`ledger task "${specs.task}" failed:\n`, e)
				await wait(3000)
			}
		}
	},
	loopTimeTask: async (specs, task) => {
		while(true){
			if(specs.subject){
				let operation = await repo.operations.getNext(specs.task, specs.subject)

				if(!operation || (operation.result === 'success' && operation.start + specs.interval > unixNow())){
					await wait(1000)
					continue
				}

				await repo.operations.record(
					specs.task, 
					`${specs.subject}${operation.entity}`, 
					task(unixNow(), operation.entity)
				)
			}else{
				let recent = await repo.operations.getMostRecent(specs.task)

				if(recent && recent.result === 'success' && recent.start + specs.interval > unixNow()){
					await wait(1000)
					continue
				}

				await repo.operations.record(specs.task, null, task(unixNow()))
			}
		}
	}
})