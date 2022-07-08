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
		throw error
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
		await wait(1)

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

		if(previousOperation)
			continue

		try{
			await routine(item)
		}catch(error){
			throw error
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
