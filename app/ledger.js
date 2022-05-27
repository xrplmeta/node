import log from '@mwni/log'
import { spawn } from 'nanotasks'
import { openLedger, cloneLedger, openMeta } from '../db/index.js'
import { isIncomplete } from '../ledger/state.js'
import { create as createSnapshot } from '../ledger/snapshot.js'
import { create as createCheckpoint } from '../meta/checkpoint.js'



export default async function(ctx){
	let ledger = await openLedger({ ...ctx, variant: 'live' })

	if(await isIncomplete({ ledger })){
		await spawn(':runCreateSnapshot', { ...ctx, log })
	}

	await spawn(':runLive', { ...ctx, log })
	await spawn(':runBackfill', { ...ctx, log })
}


export async function runCreateSnapshot(ctx){
	log.pipe(ctx.log)

	let ledger = await openLedger({ ...ctx, variant: 'live' })

	log.info('creating snapshot now')
	await createSnapshot({ ...ctx, ledger })

	log.info('cloning ledger file for backfill...')
	await cloneLedger({ ...ctx, ledger, newVariant: 'backfill' })
	log.info('ledger file successfully cloned')
}

export async function runLive(ctx){
	log.pipe(ctx.log)
	
	let ledger = await openLedger({ ...ctx, variant: 'live' })
	let meta = await openMeta({ ...ctx })

	await createCheckpoint({ ...ctx, meta, ledger })

	//await live.work({ ...ctx, ledger })
}

export async function runBackfill(ctx){
	
}