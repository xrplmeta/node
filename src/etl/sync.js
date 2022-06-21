import log from '@mwni/log'
import { startForwardStream } from '../xrpl/stream.js'
import { extractEvents } from './events/extract.js'
import { applyTransactions } from './state/apply.js'
import { deriveComposites } from './composites/derive.js'
import { buildAggregates } from './aggregates/build.js'


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
				affectedScopes: {}
			}

			extractTransactionEvents({ ctx, ledger })
			applyLedgerTransactions({ ctx, ledger })
			deriveComposites({ ctx, ledger })
			buildAggregates({ ctx, ledger })
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