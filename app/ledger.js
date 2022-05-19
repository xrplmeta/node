import log from '@mwni/log'
import { spawn } from 'nanotasks'
import * as database from '../ledger/database.js'
import * as snapshot from '../ledger/snapshot.js'
import * as checkpoint from '../ledger/checkpoint.js'
import * as live from '../ledger/live.js'
import * as backfill from '../ledger/backfill.js'



export default async function(ctx){
	let ledger = database.init({ ...ctx, variant: 'live' })

	if(await ledger.isIncomplete()){
		await spawn(':createSnapshot', { ...ctx, log })
	}

	await spawn(':workLive', { ...ctx, log })
	await spawn(':workBackfill', { ...ctx, log })
}


export async function createSnapshot(ctx){
	log.pipe(ctx.log)

	let ledger = database.init({ ...ctx, variant: 'live' })

	await snapshot.create({ ...ctx, ledger })
	await ledger.fork({ variant: 'backfill' })
}

export async function workLive(ctx){
	log.pipe(ctx.log)
	
	let ledger = database.init({ ...ctx, variant: 'live' })

	await checkpoint.create({ ...ctx, ledger })

	//await live.work({ ...ctx, ledger })
}

export async function workBackfill(ctx){
	
}