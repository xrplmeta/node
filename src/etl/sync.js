import log from '@mwni/log'
import { startForwardStream } from '../xrpl/stream.js'
import { extractEvents } from './events/extract.js'
import { applyTransactions } from './state/apply.js'
import { deriveComposites } from './composites/derive.js'
import { buildAggregates } from './aggregates/build.js'
import { createScopeRegistry } from '../lib/scopereg.js'


export async function startSync({ ctx }){
	let { sequence: lastSequence } = ctx.db.ledgers.readOne({
		orderBy: {
			sequence: 'desc'
		},
		take: 1
	})
	
	let stream = await startForwardStream({ 
		ctx, 
		startSequence: lastSequence + 1 
	})

	
	while(true){
		let ledger = await stream.next()
		let ledgersBehind = stream.targetSequence - stream.currentSequence

		ctx.db.tx(() => {
			ctx = {
				...ctx,
				ledgerSequence: ledger.sequence,
				...createScopeRegistry()
			}

			try{
				extractEvents({ ctx, ledger })
				applyTransactions({ ctx, ledger })
				deriveComposites({ ctx, ledger })
				buildAggregates({ ctx, ledger })
			}catch(error){
				log.error(`fatal error while syncing ledger #${ledger.sequence}:`)
				log.error(error.stack)

				throw error
			}
		})


		if(ledgersBehind > 0){
			log.accumulate.info({
				text: [
					ledgersBehind,
					`ledgers behind (+%advancedLedgers in %time)`
				],
				data: {
					advancedLedgers: 1
				}
			})
		}else{
			log.flush()
			log.info(`synced with ledger #${ledger.sequence}`)
		}
	}
}