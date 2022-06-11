import log from '@mwni/log'
import { open as openMetaStore } from '../../store/meta.js'
import { open as openStateStore } from '../../store/state.js'
import { advance as advanceState } from '../../lib/ledger/diff.js'
import { start as startStream } from '../../lib/ledger/stream.js'
import { reduce as reduceState } from '../../lib/ledger/reduce/index.js'
import { extract as extractLedgerMeta } from '../../lib/meta/ledgers.js'
import { extract as extractTokenExchanges } from '../../lib/meta/token/exchanges.js'


export async function run(ctx){
	if(ctx.log)
		log.pipe(ctx.log)

	
	let meta = await openMetaStore(ctx)
	let state = await openStateStore({ ...ctx, variant: 'current' })

	let { ledgerIndex: startLedgerIndex } = await state.journal.readOne({ last: true })
	
	let stream = await startStream({ ...ctx, direction: 'forward', startLedgerIndex })

	while(true){
		await reduceState({ ...ctx, meta, state })

		let { ledger, ledgersBehind } = await stream.next()

		await extractLedgerMeta({ ledger, meta })
		await extractTokenExchanges({ ledger, meta })
		await advanceState({ ledger, state })

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