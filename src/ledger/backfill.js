import log from '@mwni/log'
import { spawn } from '@mwni/workers'
import { applyLedgerEvents } from './events/index.js'
import { createMissingMPTokenIssuanceFromTransactions } from '../xrpl/mpt.js'
import { applyLedgerStateFromTransactions } from './state/index.js'
import { updateDerived } from './derived/index.js'
import { pullNewItems, readTableHeads } from '../db/helpers/heads.js'
import { wait } from '@xrplkit/time'


export async function startBackfill({ ctx }){
	let { sequence: firstSequence } = ctx.db.core.ledgers.readOne({
		orderBy: {
			sequence: 'asc'
		},
		take: 1
	})
	
	let stream = await spawn(
		'../xrpl/stream.js:createBackwardStream',
		{
			ctx,
			startSequence: firstSequence - 1 
		}
	)
	
	while(true){
		let { ledger } = await stream.next()

		await createMissingMPTokenIssuanceFromTransactions({ ctx, ledger })

		ctx.db.core.tx(() => {
			ctx = {
				...ctx,
				currentLedger: ledger,
				ledgerSequence: ledger.sequence,
				backwards: true
			}

			try{
				let heads = readTableHeads({ ctx })

				applyLedgerEvents({ ctx, ledger })
				applyLedgerStateFromTransactions({ ctx, ledger })
				updateDerived({ 
					ctx,
					newItems: pullNewItems({ 
						ctx, 
						previousHeads: heads 
					})
				})
			}catch(error){
				log.error(`fatal error while backfilling ledger #${ledger.sequence}:`)
				log.error(error.stack)

				throw error
			}
		})

		log.accumulate.info({
			text: [
				`at ledger #${ledger.sequence} ${
					new Date(ledger.closeTime * 1000)
						.toISOString()
						.slice(0, -5)
						.replace('T', ' ')
				} (+%backfilledLedgers in %time)`
			],
			data: {
				backfilledLedgers: 1
			}
		})

		await wait(10)
	}
}