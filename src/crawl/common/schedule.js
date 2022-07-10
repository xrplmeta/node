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

export async function scheduleIterator({ ctx, iterator, subjectType, task, interval, routine }){
	for(let item of iterator){
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


export async function scheduleBatchedIterator({ ctx, iterator, subjectType, task, interval, batchSize, routine }){
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

	let now = unixNow()

	for(let item of iterator){
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
