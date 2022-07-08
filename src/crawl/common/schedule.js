import log from '@mwni/log'
import { unixNow, wait } from '@xrplkit/time'


export async function scheduleGlobal({ ctx, task, interval, routine }){
	try{
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
		await routine()

	}catch(error){
		log.warn(`scheduled task "${task}" failed:`, error.message)
	}finally{
		ctx.db.operations.createOne({
			data: {
				subjectType: 'global',
				subjectId: 0,
				task,
				time: unixNow()
			}
		})
	}
}

export async function scheduleIterator({ ctx, iterator, subjectType, task, interval, routine }){
	for(let item of iterator){
		try{
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

			await routine(item)

		}catch(error){
			console.log(error)
			log.warn(`scheduled task "${task}" failed for item:`, error.message)
		}finally{
			ctx.db.operations.createOne({
				data: {
					subjectType,
					subjectId: item.id,
					task,
					time: unixNow()
				}
			})
		}
	}
}
