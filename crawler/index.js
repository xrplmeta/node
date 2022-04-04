import * as snapshot from './ledger/snapshot.js'
import * as backfill from './ledger/backfill.js'
import * as stream from './ledger/stream.js'
import * as domains from './issuers/domains.js'
import * as aux from './issuers/auxiliary.js'
import * as xumm from './thirdparty/xumm.js'
import * as bithomp from './thirdparty/bithomp.js'
import * as xrpscan from './thirdparty/xrpscan.js'
import * as gravatar from './thirdparty/gravatar.js'
import * as twitter from './thirdparty/twitter.js'
import { setContext } from './routine.js'

export const tasks = {}

const map = {
	snapshot,
	backfill,
	stream,
	domains,
	aux,
	xumm,
	bithomp,
	xrpscan,
	gravatar,
	twitter
}

for(let [id, task] of Object.entries(map)){
	tasks[`crawler:${id}`] = {
		...task,
		run: ctx => {
			setContext(ctx)
			task.run(ctx)
		}
	}
}