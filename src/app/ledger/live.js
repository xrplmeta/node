import log from '@mwni/log'
import { getCurrentIndex, isCheckpointDue } from '../../lib/snapshot/state.js'
import { open as openMetaStore } from '../../store/meta.js'
import { open as openSnapshotStore } from '../../store/snapshot.js'
import { advance as advanceSnapshot } from '../../lib/snapshot/diff.js'
import { start as startStream } from '../../lib/ledger/stream.js'
import { create as createCheckpoint } from '../../lib/meta/checkpoint.js'
import { extract as extractLedgerMeta } from '../../lib/meta/ledgers.js'
import { extract as extractTokenExchanges } from '../../lib/meta/token/exchanges.js'


export async function run(ctx){
	if(ctx.log)
		log.pipe(ctx.log)

	
	let meta = await openMetaStore(ctx)
	let snapshot = await openSnapshotStore({ ...ctx, variant: 'live' })
	let startLedgerIndex = await getCurrentIndex({ snapshot })
	let stream = await startStream({ ...ctx, direction: 'forward', startLedgerIndex })

	while(true){
		if(await isCheckpointDue({ ...ctx, snapshot })){
			await createCheckpoint({ ...ctx, snapshot, meta })
		}

		let ledger = await stream.next()

		await extractLedgerMeta({ ledger, meta })
		await extractTokenExchanges({ ledger, meta })
		await advanceSnapshot({ ledger, snapshot })

		log.accumulate.info({
			line: [`advanced %advancedLedgers ledgers in %time`],
			advancedLedgers: 1
		})
	}
}