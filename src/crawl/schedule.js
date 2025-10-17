import log from '@mwni/log'
import { unixNow, wait } from '@xrplkit/time'


export async function scheduleGlobal({ ctx, task, interval, routine }){
	let duration = 0
	let previousOperation = ctx.db.core.operations.readOne({
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

		ctx.db.core.operations.createOne({
			data: {
				subjectType: 'global',
				subjectId: 0,
				task,
				time: unixNow()
			}
		})
	}catch(error){
		log.warn(`scheduled task "${task}" failed:\n`, error.stack || error.message || error)
		await wait(4000)
	}
}

export async function scheduleIterator({ ctx, type, where, include, task, interval, concurrency = 1, routine }){
	let { table, ids } = collectItemIds({ ctx, type, where })

	log.debug(`${task}:`, ids.length, `items[${table}] to iterate`)

	await Promise.all(
		Array(concurrency)
			.fill(0)
			.map(async () => {
				while(ids.length > 0){
					let id = ids.shift()
					let item = ctx.db.core[table].readOne({
						where: {
							id
						},
						include
					})

					let previousOperation = ctx.db.core.operations.readOne({
						where: {
							subjectType: type,
							subjectId: item.id,
							task,
							time: {
								greaterThan: unixNow() - interval
							}
						}
					})

					if(previousOperation)
						continue

					try{
						await routine(item, ids.length)
					}catch(error){
						log.warn(`scheduled task "${task}" failed for item:\n`, error.stack || error.message || error)
						await wait(3000)
					}

					ctx.db.core.operations.createOne({
						data: {
							subjectType: type,
							subjectId: item.id,
							task,
							time: unixNow()
						}
					})
				}
			})
	)

	await wait(1)
}


export async function scheduleBatchedIterator({ ctx, type, where, include, task, interval, batchSize, accumulate, commit }){
	let queue = []
	let flush = async () => {
		let batch = queue.splice(0, batchSize)

		try{
			await commit(batch)
		}catch(error){
			log.warn(`scheduled task "${task}" failed for batch:\n`, error.stack || error.message || error)
		}

		let time = unixNow()

		for(let { items } of batch){
			for(let item of items){
				ctx.db.core.operations.createOne({
					data: {
						subjectType: type,
						subjectId: item.id,
						task,
						time
					}
				})
			}
		}
	}

	let { table, ids } = collectItemIds({ ctx, type, where })
	let now = unixNow()

	log.debug(`${task}:`, ids.length, `items[${table}] to iterate`)

	for(let id of ids){
		let item = ctx.db.core[table].readOne({ 
			where: { id },
			include
		})

		let previousOperation = ctx.db.core.operations.readOne({
			where: {
				subjectType: type,
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

function collectItemIds({ ctx, type, where }){
	if(type === 'issuer'){
		return {
			table: 'accounts',
			ids: ctx.db.core.tokens.readMany({ 
				select: { issuer: true }, 
				distinct: ['issuer'],
				where
			})
				.map(row => row.issuer?.id)
				.filter(Boolean)
				.reverse()
		}
	}else{
		return {
			table: 'tokens',
			ids: ctx.db.core.tokens.readMany({
				select: { id: true },
				where
			})
				.map(row => row.id)
				.reverse()
		}
	}
}