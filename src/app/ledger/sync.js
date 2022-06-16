import log from '@mwni/log'
import { open as openMetaStore } from '../../store/meta.js'
import { diff as diffLedgerState } from '../../core/diff/index.js'
import { start as startStream } from '../../lib/ledger/stream.js'
import { extract as extractLedgerMeta } from '../../lib/meta/ledgers.js'
import { extract as extractTokenExchanges } from '../../lib/meta/token/exchanges.js'


export async function run(ctx){
	if(ctx.log)
		log.pipe(ctx.log)

	ctx.meta = openMetaStore(ctx)

	let { ledgerIndex: startLedgerIndex } = ctx.meta.ledgers.readOne({
		orderBy: {
			ledgerIndex: 'desc'
		},
		take: 1
	})
	
	let stream = await startStream({ ctx, startLedgerIndex })

	while(true){
		let { ledger, ledgersBehind } = await stream.next()

		extractLedgerMeta({ ctx, ledger })
		extractTokenExchanges({ ctx, ledger })
		diffLedgerState({ ctx, ledger })

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
			log.info(`synced at ledger #${ledger.index}`)
		}

		process.exit()
	}
}