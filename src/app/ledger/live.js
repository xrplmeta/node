import log from '@mwni/log'
import { open as openMetaStore } from '../../store/meta.js'
import { open as openStateStore } from '../../store/state.js'
import { advance as advanceState } from '../../lib/ledger/diff.js'
import { start as startStream } from '../../lib/ledger/stream.js'
import { pull as pullFromState } from '../../lib/meta/pull.js'
import { extract as extractLedgerMeta } from '../../lib/meta/ledgers.js'
import { extract as extractTokenExchanges } from '../../lib/meta/token/exchanges.js'


export async function run(ctx){
	if(ctx.log)
		log.pipe(ctx.log)

	
	let meta = await openMetaStore(ctx)
	let state = await openStateStore({ ...ctx, variant: 'current' })

	let { ledgerIndex: startLedgerIndex } = await state.journal.readOne({ last: true })

	await pullFromState({ ...ctx, meta, state })
	
	/*let stream = await startStream({ ...ctx, direction: 'forward', startLedgerIndex })

	while(true){
		if(await isCheckpointDue({ ...ctx, snapshot })){
			await createCheckpoint({ ...ctx, snapshot, meta })
		}

		let ledger = await stream.next()

		await extractLedgerMeta({ ledger, meta })
		await extractTokenExchanges({ ledger, meta })
		await advanceState({ ledger, snapshot })

		log.accumulate.info({
			line: [`advanced %advancedLedgers ledgers in %time`],
			advancedLedgers: 1
		})
	}*/
}