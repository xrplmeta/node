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

	await wait(duration * 1000 + 1)

	try{
		await routine()
	}catch(error){
		log.warn(`scheduled task "${task}" failed:\n`, error.stack)
	}

	ctx.db.operations.createOne({
		data: {
			subjectType: 'global',
			subjectId: 0,
			task,
			time: unixNow()
		}
	})
}

export async function scheduleIterator({ ctx, iterator: { table, ...iterator }, subjectType, task, interval, routine }){
	let ids = []

	for(let item of ctx.db[table].iter(iterator)){
		ids.push(item.id)
	}

	log.debug(`${task}:`, ids.length, `items[${table}] to iterate`)

	for(let id of ids){
		let item = ctx.db[table].readOne({
			where: {
				id
			}
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

		try{
			await routine(item)

		}catch(error){
			log.warn(`scheduled task "${task}" failed for item:\n`, error.stack)
		}

		ctx.db.operations.createOne({
			data: {
				subjectType,
				subjectId: item.id,
				task,
				time: unixNow()
			}
		})
	}

	await wait(1)
}


export async function scheduleBatchedIterator({ ctx, iterator: { table, ...iterator }, subjectType, task, interval, batchSize, routine }){
	let ids = []
	let batch = []
	let flush = async () => {
		try{
			await routine(batch)
		}catch(error){
			log.warn(`scheduled task "${task}" failed for batch:\n`, error.stack)
		}

		let time = unixNow()

		for(let item of batch){
			ctx.db.operations.createOne({
				data: {
					subjectType,
					subjectId: item.id,
					task,
					time
				}
			})
		}

		batch = []
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
			}
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

		batch.push(item)

		if(batch.length >= batchSize)
			await flush()
	}

	if(batch.length > 0)
		await flush()

	await wait(1)
}
