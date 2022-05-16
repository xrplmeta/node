import * as database from '../../stream/database.js'
import * as live from '../../stream/live.js'
import * as backfill from '../../stream/backfill.js'


export const name = 'ledger.stream'

export async function skip(ctx){
	return ctx.args.only && !ctx.args.only.includes(name)
}

export async function start(ctx){
	await spawn(':workLive', ctx)
	await spawn(':workBackfill', ctx)
}

export async function workLive(ctx){
	let stream = database.init({ ctx })

	await live.work({ ctx, stream })
}

export async function workBackfill(ctx){
	let stream = database.init({ ctx })

	await backfill.work({ ctx, stream })
}