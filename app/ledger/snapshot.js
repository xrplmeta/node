import { spawn } from 'nanotasks'
import * as database from '../../snapshot/database.js'
import * as checkpoint from '../../snapshot/capture.js'
import * as live from '../../snapshot/live.js'
import * as backfill from '../../snapshot/backfill.js'


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
}