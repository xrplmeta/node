import log from '@mwni/log'
import { startForwardStream } from '../xrpl/stream.js'
import { extractEvents } from './events/extract.js'
import { applyTransactions } from './state/apply.js'
import { deriveComposites } from './composites/derive.js'
import { buildAggregates } from './aggregates/build.js'
import { createScopeRegistry } from '../lib/scopereg.js'


export async function startBackfill({ ctx }){
	let { sequence: firstSequence } = ctx.db.ledgers.readOne({
		orderBy: {
			sequence: 'asc'
		},
		take: 1
	})
	
	let stream = await startBackwardStream({ 
		ctx, 
		startSequence: firstSequence - 1 
	})

	
	while(true){
		let ledger = await stream.next()

		ctx.db.tx(() => {
			ctx = {
				...ctx,
				ledgerSequence: ledger.sequence,
				inBackfill: true,
				...createScopeRegistry()
			}

			try{
				extractEvents({ ctx, ledger })
				applyTransactions({ ctx, ledger })
				deriveComposites({ ctx, ledger })
				buildAggregates({ ctx, ledger })
			}catch(error){
				log.error(`fatal error while backfilling ledger #${ledger.sequence}:`)
				log.error(error.stack)

				throw error
			}
		})


		log.accumulate.info({
			text: [
				ledgersBehind,
				`at ledger #${ledger.sequence} ${new Date(ledger.closeTime)} (+%backfilledLedgers in %time)`
			],
			data: {
				backfilledLedgers: 1
			}
		})
		
	}
}