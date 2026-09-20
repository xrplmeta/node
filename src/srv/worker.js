import log from '@mwni/log'
import { spawn } from '@mwni/workers'
import { openDB } from '../db/index.js'
import * as procedures from './api.js'
import { resolveCost, throwRateLimited } from './ratelimit.js'


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

	if(ctx.rateLimiter?.enabled && ctx.ip){
		let result = ctx.rateLimiter.consume({
			ip: ctx.ip,
			cost: resolveCost(func, params)
		})

		if(!result.allowed){
			log.debug(`rate limited ${ctx.ip} on ${procedure}`)
			throwRateLimited(result)
		}
	}

	if(func.mustRunMainThread){
		return json(await func({ ...params, ctx }), requestId)
	}

	if(!ctx.taskQueue)
		throw new Error(`ctx has no taskQueue`)

	let lane = func.slow ? 'slow' : 'fast'
	let queue = ctx.taskQueue[lane]

	let task = {
		procedure,
		params,
		requestId,
		lane,
		processing: false,
		worker: null,
		queuedAt: Date.now(),
		startedAt: null
	}

	let promise = new Promise((resolve, reject) => {
		task.resolve = resolve
		task.reject = reject
	})

	queue.push(task)

	log.debug(`queued ${procedure} in ${lane} lane (${queue.length} tasks in ${lane} queue)`)

	dispatchTasks({ ctx })

	return await promise
}

function nextPendingTask({ ctx }){
	return ctx.taskQueue.fast.find(task => !task.processing)
		|| ctx.taskQueue.slow.find(task => !task.processing)
}

function dispatchTasks({ ctx }){
	while(true){
		let task = nextPendingTask({ ctx })

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

		log.debug(`processing ${task.procedure} from ${task.lane} lane (${idleWorkers.length - 1} workers idle)`)

		worker.execute({
			procedure: task.procedure,
			params: task.params,
			requestId: task.requestId
		})
			.then(result => task.resolve(result))
			.catch(error => task.reject(error))
			.finally(() => {
				let queue = ctx.taskQueue[task.lane]

				queue.splice(queue.indexOf(task), 1)
				worker.busy = false
				dispatchTasks({ ctx })
			})
	}
}

export function getWorkerQueueSnapshot({ ctx }){
	let now = Date.now()

	if(!ctx.taskQueue)
		return []

	return [...ctx.taskQueue.fast, ...ctx.taskQueue.slow].map(
		task => ({
			command: task.procedure,
			lane: task.lane,
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