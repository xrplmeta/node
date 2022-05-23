import log from '@mwni/log'
import { spawn } from 'nanotasks'
import { open as openLedgerDatabase } from '../ledger/database.js'
import { open as openMetaDatabase } from '../meta/database.js'
import * as snapshot from '../ledger/snapshot.js'
import * as checkpoint from '../meta/checkpoint.js'



export default async function(ctx){
	let ledger = openLedgerDatabase({ ...ctx, variant: 'live' })

	if(await ledger.isIncomplete()){
		await spawn(':createSnapshot', { ...ctx, log })
	}

	await spawn(':workLive', { ...ctx, log })
	await spawn(':workBackfill', { ...ctx, log })
}


export async function createSnapshot(ctx){
	log.pipe(ctx.log)

	let ledger = openLedgerDatabase({ ...ctx, variant: 'live' })

	await snapshot.create({ ...ctx, ledger })
	await ledger.fork({ variant: 'backfill' })
}

export async function workLive(ctx){
	log.pipe(ctx.log)
	
	let ledger = openLedgerDatabase({ ...ctx, variant: 'live' })
	let meta = openMetaDatabase({ ...ctx })

	await checkpoint.create({ ...ctx, meta, ledger })

	//await live.work({ ...ctx, ledger })
}

export async function workBackfill(ctx){
	
}