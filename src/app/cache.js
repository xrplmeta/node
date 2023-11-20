import log from '@mwni/log'
import { spawn } from '@mwni/workers'
import { openDB } from '../db/index.js'
import { startCacheWorker } from '../cache/worker.js'


export async function run({ ctx }){
	await spawn(':runCacheWorker', { ctx })
}


export async function runCacheWorker({ ctx }){
	if(ctx.log)
		log.pipe(ctx.log)

	log.info('starting cache worker')

	return await startCacheWorker({
		ctx: {
			...ctx,
			db: await openDB({
				ctx,
				coreReadOnly: true
			})
		}
	})
}