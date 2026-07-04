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

	if(!ctx.taskQueue)
		ctx.taskQueue = []

	let task = {
		procedure,
		params,
		requestId,
		processing: false,
		worker: null,
		queuedAt: Date.now(),
		startedAt: null
	}

	let promise = new Promise((resolve, reject) => {
		task.resolve = resolve
		task.reject = reject
	})

	ctx.taskQueue.push(task)

	log.debug(`queued ${procedure} (${ctx.taskQueue.length} tasks in queue)`)

	dispatchTasks({ ctx })

	return await promise
}

function dispatchTasks({ ctx }){
	while(true){
		let task = ctx.taskQueue.find(task => !task.processing)

		if(!task)
			break

		let idleWorkers = ctx.workers.filter(worker => !worker.busy)

		if(idleWorkers.length === 0)
			break

		let worker = idleWorkers
			.sort((a, b) => (a.lastRequestTime || 0) - (b.lastRequestTime || 0))
			.at(0)

		task.processing = true
		task.worker = worker
		task.startedAt = Date.now()

		worker.busy = true
		worker.lastRequestTime = task.startedAt

		log.debug(`processing ${task.procedure} (${idleWorkers.length - 1} workers idle)`)

		worker.execute({
			procedure: task.procedure,
			params: task.params,
			requestId: task.requestId
		})
			.then(result => task.resolve(result))
			.catch(error => task.reject(error))
			.finally(() => {
				ctx.taskQueue.splice(ctx.taskQueue.indexOf(task), 1)
				worker.busy = false
				dispatchTasks({ ctx })
			})
	}
}

export function getWorkerQueueSnapshot({ ctx }){
	let now = Date.now()

	if(!ctx.taskQueue)
		return []

	return ctx.taskQueue.map(
		task => ({
			command: task.procedure,
			queue_time: now - task.queuedAt,
			...(
				task.processing
					? {
						worker: ctx.workers.indexOf(task.worker),
						processing_time: now - task.startedAt
					}
					: {}
			)
		})
	)
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