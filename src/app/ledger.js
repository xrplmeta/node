import log from '@mwni/log'
import { spawn } from 'nanotasks'
import { create as createPool } from '../xrpl/nodepool.js'
import { open as openDB } from '../db/index.js'
import { createSnapshot } from '../etl/ledger/snapshot.js'
import { startSync } from '../etl/ledger/sync.js'
import { startBackfill } from '../etl/ledger/backfill.js'


export async function run({ config }){
	let ctx = { 
		xrpl: createPool(config.ledger.sources),
		config, 
		log,
	}
	
	await spawn(':runSnapshot', { ctx })

	await (await spawn(':runSync', { ctx }))
		.onceInSync()

	await spawn(':runBackfill', { ctx })
}


export async function runSnapshot({ ctx }){
	if(ctx.log)
		log.pipe(ctx.log)

	return await createSnapshot({
		ctx: {
			...ctx,
			db: openDB({ ctx })
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
			db: openDB({ ctx })
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
			db: openDB({ ctx })
		}
	})
}