import log from '@mwni/log'
import { spawn } from 'nanotasks'
import * as database from '../ledger/database.js'
import * as snapshot from '../ledger/snapshot.js'
import * as live from '../ledger/live.js'
import * as backfill from '../ledger/backfill.js'



export default async function(ctx){
	let ledger = database.init({ ...ctx, variant: 'live' })

	if(await ledger.isIncomplete()){
		await spawn(':createSnapshot', { ...ctx, log })
	}

	await spawn(':workLive', ctx)
	await spawn(':workBackfill', ctx)
}


export async function createSnapshot(ctx){
	let ledger = database.init({ ...ctx, variant: 'live' })

	log.pipe(ctx.log)

	await snapshot.create({ ...ctx, ledger })
	await ledger.fork({ variant: 'backfill' })
}



/*
export const name = 'ledger.snapshot'

export async function skip(ctx){
	return ctx.args.only && !ctx.args.only.includes(name)
}

export async function start(ctx){
	let snapshot = database.init({ ctx, variant: 'live' })

	if(await snapshot.isIncomplete()){
		await spawn(':createCheckpoint', ctx)
	}

	await spawn(':workLive', ctx)
	await spawn(':workBackfill', ctx)
}

export async function createCheckpoint(ctx){
	let snapshot = database.init({ ctx, variant: 'live' })

	await checkpoint.create({ ctx, snapshot })
	await snapshot.fork({ variant: 'backfill' })
}

export async function workLive(ctx){
	let snapshot = database.init({ ctx, variant: 'live' })

	await live.work({ ctx, snapshot })
}

export async function workBackfill(ctx){
	let snapshot = database.init({ ctx, variant: 'backfill' })

	await backfill.work({ ctx, snapshot })
}*/