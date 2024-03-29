import log from '@mwni/log'
import { spawn } from '@mwni/workers'
import { createPool } from '../xrpl/nodepool.js'
import { openDB } from '../db/index.js'
import { createSnapshot } from '../etl/snapshot.js'
import { startSync } from '../etl/sync.js'
import { startBackfill } from '../etl/backfill.js'


export async function run({ ctx }){
	ctx = { 
		...ctx,
		xrpl: createPool(ctx.config.source.xrpls),
	}

	await spawn(':runSnapshot', { ctx })

	spawn(':runSync', { ctx })
		.then(task => task.onceInSync())
		.then(() => spawn(':runBackfill', { ctx }))
}


export async function runSnapshot({ ctx }){
	if(ctx.log)
		log.pipe(ctx.log)

	return await createSnapshot({
		ctx: {
			...ctx,
			db: await openDB({ ctx })
		}
	})
}

export async function runSync({ ctx }){
	if(ctx.log)
		log.pipe(ctx.log)

	log.info('starting sync')

	return await startSync({
		ctx: {
			...ctx,
			db: await openDB({ ctx })
		}
	})
}

export async function runBackfill({ ctx }){
	if(ctx.log)
		log.pipe(ctx.log)

	log.info('starting backfill')

	return await startBackfill({
		ctx: {
			...ctx,
			db: await openDB({ ctx })
		}
	})
}