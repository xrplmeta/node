import log from '@mwni/log'
import { unixNow, wait } from '@xrplkit/time'


export async function scheduleGlobal({ ctx, task, interval, routine }){
	let duration = 0
	let previousOperation = ctx.db.operations.readOne({
		where: {
			subjectType: 'global',
			subjectId: 0,
			task
		}
	})

	if(previousOperation)
		duration = interval - unixNow() + previousOperation.time

	if(duration > 0)
		log.debug(`${task}:`, `waiting ${duration} seconds for next operation`)

	await wait(duration * 1000 + 1)

	try{
		await routine()

		ctx.db.operations.createOne({
			data: {
				subjectType: 'global',
				subjectId: 0,
				task,
				time: unixNow()
			}
		})
	}catch(error){
		log.warn(`scheduled task "${task}" failed:\n`, error.stack)
		await wait(4000)
	}
}

export async function scheduleIterator({ ctx, iterator: { table, ...iterator }, subjectType, task, interval, concurrency = 1, routine }){
	let ids = []
	let promises = []

	for(let item of ctx.db[table].iter(iterator)){
		ids.push(item.id)
	}

	log.debug(`${task}:`, ids.length, `items[${table}] to iterate`)

	for(let id of ids){
		let item = ctx.db[table].readOne({
			where: {
				id
			},
			include: iterator.include
		})

		let previousOperation = ctx.db.operations.readOne({
			where: {
				subjectType,
				subjectId: item.id,
				task,
				time: {
					greaterThan: unixNow() - interval
				}
			}
		})

		await wait(1)

		if(previousOperation)
			continue

		let promise = routine(item)
			.then(() => {
				promises.splice(promises.indexOf(promise), 1)
			})
			.catch(error => {
				log.warn(`scheduled task "${task}" failed for item:\n`, error.stack)
			})
			.then(() => {
				ctx.db.operations.createOne({
					data: {
						subjectType,
						subjectId: item.id,
						task,
						time: unixNow()
					}
				})
			})
		
		promises.push(promise)

		if(promises.length >= concurrency){
			await Promise.any(promises)
		}
	}

	await wait(1)
}


export async function scheduleBatchedIterator({ ctx, iterator: { table, ...iterator }, subjectType, task, interval, batchSize, accumulate, commit }){
	let ids = []
	let queue = []
	let flush = async () => {
		let batch = queue.splice(0, batchSize)

		try{
			await commit(batch)
		}catch(error){
			log.warn(`scheduled task "${task}" failed for batch:\n`, error.stack)
		}

		let time = unixNow()

		for(let { items } of batch){
			for(let item of items){
				ctx.db.operations.createOne({
					data: {
						subjectType,
						subjectId: item.id,
						task,
						time
					}
				})
			}
		}
	}

	for(let item of ctx.db[table].iter(iterator)){
		ids.push(item.id)
	}

	log.debug(`${task}:`, ids.length, `items[${table}] to iterate`)


	let now = unixNow()

	for(let id of ids){
		let item = ctx.db[table].readOne({
			where: {
				id
			},
			include: iterator.include
		})

		let previousOperation = ctx.db.operations.readOne({
			where: {
				subjectType,
				subjectId: item.id,
				task,
				time: {
					greaterThan: now - interval
				}
			}
		})

		await wait(1)

		if(previousOperation)
			continue

		queue = accumulate(queue, item)

		if(queue.length >= batchSize)
			await flush()
	}

	if(queue.length > 0)
		await flush()

	await wait(1)
}
