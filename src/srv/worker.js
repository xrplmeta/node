import log from '@mwni/log'
import { spawn } from '@mwni/workers'
import { openDB } from '../db/index.js'
import * as procedures from './api.js'


export async function spawnWorkers({ ctx }){
	let num = ctx.config.server.workers || 3
	let { db, ...workerCtx } = ctx

	log.info(`spawning ${num} workers`)

	return Promise.all(
		Array(num).fill(0).map(
			async () => await spawn(':runWorker', { ctx: workerCtx })
		)
	)
}

export async function executeProcedure({ ctx, procedure, params, requestId }){
	let func = procedures[procedure]

	if(func.mustRunMainThread){
		return json(await func({ ...params, ctx }), requestId)
	}

	let now = Date.now()
	let ranking = ctx.workers
		.map(worker => ({ worker, score: now - (worker.lastRequestTime || 0) - (!!worker.busy) * 1000000000 }))
		.sort((a, b) => b.score - a.score)
	

	log.debug(`available for handling ${procedure}`, ranking.map(({ worker, score }) => ({ busy: worker.busy, score })))

	let worker = ranking.at(0).worker

	worker.busy = true
	worker.lastRequestTime = now

	try{
		return await worker.execute({ procedure, params, requestId })
	}catch(error){
		throw error
	}finally{
		worker.busy = false
	}
}

export async function runWorker({ ctx }){
	if(ctx.log)
		log.pipe(ctx.log)

	ctx = {
		...ctx,
		db: await openDB({ ctx })
	}

	return {
		async execute({ procedure, params, requestId }){
			return json(await procedures[procedure]({ ...params, ctx }), requestId)
		}
	}
}

function json(data, requestId){
	if(requestId)
		data = { result: data, id: requestId }

	return JSON.stringify(data, null, 2)
}