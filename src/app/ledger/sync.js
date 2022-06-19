import log from '@mwni/log'
import { open as openMetaStore } from '../../store/meta.js'
import { diff as diffLedgerState } from '../../core/diff/index.js'
import { startForward as startStream } from '../../lib/xrpl/stream.js'
import { extract as extractLedgerMeta } from '../../lib/meta/generic/ledgers.js'
import { extract as extractTokenExchanges } from '../../lib/meta/token/exchanges.js'
import { update as updateMarketcaps } from '../../core/postdiff/marketcap.js'


export async function run({ ctx }){
	if(ctx.log)
		log.pipe(ctx.log)

	log.info('starting')

	ctx.meta = openMetaStore({ ctx })

	let { sequence: lastSequence } = ctx.meta.ledgers.readOne({
		orderBy: {
			sequence: 'desc'
		},
		take: 1
	})
	
	let stream = await startStream({ 
		ctx, 
		startSequence: lastSequence + 1 
	})

	
	while(true){
		let ledger = await stream.next()
		let ledgersBehind = stream.targetSequence - stream.currentSequence
		let subjects = {}

		ctx.meta.tx(() => {
			subjects = { ...subjects, ...extractLedgerMeta({ ctx, ledger }) }
			subjects = { ...subjects, ...extractTokenExchanges({ ctx, ledger }) }
			subjects = { ...subjects, ...diffLedgerState({ ctx, ledger }) }
			subjects = { ...subjects, ...updateMarketcaps({ ctx, ledger, subjects }) }
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