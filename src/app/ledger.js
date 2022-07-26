import log from '@mwni/log'
import { spawn } from 'multitasked'
import { create as createPool } from '../xrpl/nodepool.js'
import { open as openDB } from '../db/index.js'
import { createSnapshot } from '../etl/snapshot.js'
import { startSync } from '../etl/sync.js'
import { startBackfill } from '../etl/backfill.js'


export async function run({ config }){
	let ctx = { 
		xrpl: createPool(config.etl.source),
		config, 
		log,
	}

	await spawn(':runSnapshot', { ctx })

	spawn(':runSync', { ctx })
		.then(task => task.onceInSync())
		.then(() => spawn(':runBackfill', { ctx }))
}


export async function runSnapshot({ ctx }){
	if(ctx.log)
		log.pipe(ctx.log)


	let db = openDB({ ctx })

	console.log(
		db.tokenSupply.readManyRaw({
			query: 
				`SELECT sumint(value) FROM TokenSupply LIMIT 3`,
			params: []
		})
	)

	await new Promise(r => r)

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