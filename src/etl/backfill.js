import log from '@mwni/log'
import { spawn } from '@mwni/workers'
import { extractEvents } from './events/index.js'
import { applyTransactions } from './state/index.js'
import { createDerivatives } from './derivatives/index.js'
import { pullNewItems, readTableHeads } from '../db/helpers/heads.js'
import { wait } from '@xrplkit/time'


export async function startBackfill({ ctx }){
	let { sequence: firstSequence } = ctx.db.ledgers.readOne({
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

		ctx.db.tx(() => {
			ctx = {
				...ctx,
				currentLedger: ledger,
				ledgerSequence: ledger.sequence,
				backwards: true
			}

			try{
				let heads = readTableHeads({ ctx })

				extractEvents({ ctx, ledger })
				applyTransactions({ ctx, ledger })
				createDerivatives({ 
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