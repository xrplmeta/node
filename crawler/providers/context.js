import fetch from 'node-fetch'
import Rest from '../lib/rest.js'
import { wait, unixNow } from '../../common/lib/time.js'
import { log } from '../../common/lib/log.js'



export default ({config, repo, xrpl}) => ({
	config,
	repo,
	xrpl,
	loopLedgerTask: async (specs, task) => {
		while(true){
			try{
				let { ledger, closed } = await xrpl.request({command: 'ledger'})
				let now = ledger?.ledger_index || closed?.ledger.ledger_index
				let head = Math.floor(now / specs.interval) * specs.interval
				let covered = await repo.coverage.get(specs.task, head)
				let chosen = head


				while(covered){
					let oneBefore = covered.tail - 1
					
					chosen = Math.floor(oneBefore / specs.backfillInterval) * specs.backfillInterval
					covered = await repo.coverage.get(specs.task, chosen)
				}

				await task(chosen, chosen < head)
				await repo.coverage.extend(specs.task, chosen)
			}catch(e){
				log.info(`ledger task "${specs.task}" failed:\n`, e)
				await wait(3000)
			}
		}
	}
})


export async function loopLedgerTask(repo, specs, task){
	
}