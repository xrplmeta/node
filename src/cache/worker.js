import log from '@mwni/log'
import { wait } from '@xrplkit/time'
import { 
	updateCacheForAccountProps, 
	updateCacheForTokenExchanges, 
	updateCacheForTokenMetrics, 
	updateCacheForTokenProps
} from './tokens.js'


export async function startCacheWorker({ ctx }){
	let running = true
	
	;(async () => {
		while(running){
			let todo = ctx.db.cache.todos.readOne()

			if(!todo){
				await wait(25)
				continue
			}

			switch(todo.task){
				case 'account.props': {
					updateCacheForAccountProps({ 
						ctx, 
						account: {
							id: todo.subject 
						}
					})
					break
				}
				case 'token.props': {
					updateCacheForTokenProps({ 
						ctx, 
						token: {
							id: todo.subject 
						}
					})
					break
				}
				case 'token.exchanges': {
					updateCacheForTokenExchanges({ 
						ctx, 
						token: {
							id: todo.subject 
						}
					})
					break
				}
				case 'token.metrics.trustlines': {
					updateCacheForTokenMetrics({ 
						ctx, 
						token: {
							id: todo.subject 
						},
						metrics: {
							trustlines: true
						}
					})
					break
				}
				case 'token.metrics.holders': {
					updateCacheForTokenMetrics({ 
						ctx, 
						token: {
							id: todo.subject 
						},
						metrics: {
							holders: true
						}
					})
					break
				}
				case 'token.metrics.supply': {
					updateCacheForTokenMetrics({ 
						ctx, 
						token: {
							id: todo.subject 
						},
						metrics: {
							supply: true
						}
					})
					break
				}
				case 'token.metrics.marketcap': {
					updateCacheForTokenMetrics({ 
						ctx, 
						token: {
							id: todo.subject 
						},
						metrics: {
							marketcap: true
						}
					})
					break
				}
			}

			ctx.db.cache.todos.deleteOne({
				where: {
					id: todo.id
				}
			})

			log.accumulate.info({
				text: [`processed %cacheTasksProcessed cache updates in %time`],
				data: { cacheTasksProcessed: 1 }
			})

			await wait(1)
		}
	})()

	return {
		stop(){
			running = false
		}
	}
}