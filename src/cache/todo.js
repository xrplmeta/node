import { getAccountId, getTokenId } from '../db/helpers/common.js'

export function markCacheDirtyForAccountProps({ ctx, account }){
	if(ctx.backwards)
		return

	let subject = getAccountId({ ctx, account })

	if(!subject)
		return

	ctx.db.cache.todos.createOne({
		data: {
			task: 'account.props',
			subject
		}
	})
}

export function markCacheDirtyForTokenProps({ ctx, token }){
	if(ctx.backwards)
		return

	let subject = getAccountId({ ctx, token })

	if(!subject)
		return

	ctx.db.cache.todos.createOne({
		data: {
			task: 'token.props',
			subject
		}
	})
}

export function markCacheDirtyForTokenMetrics({ ctx, token, metrics }){
	if(ctx.backwards)
		return

	let subject = getTokenId({ ctx, token })

	if(!subject)
		return

	for(let metric of Object.keys(metrics)){
		ctx.db.cache.todos.createOne({
			data: {
				task: `token.metrics.${metric}`,
				subject 
			}
		})
	}
}

export function markCacheDirtyForTokenExchanges({ ctx, token }){
	if(ctx.backwards)
		return

	if(token.currency === 'XRP')
		return

	let subject = getTokenId({ ctx, token })

	if(!subject)
		return

	ctx.db.cache.todos.createOne({
		data: {
			task: 'token.exchanges',
			subject
		}
	})
}

export function markCacheDirtyForTokenIcons({ ctx, token }){
	let subject = getTokenId({ ctx, token })

	if(!subject)
		return

	ctx.db.cache.todos.createOne({
		data: {
			task: 'token.icons',
			subject
		}
	})
}

export function markCacheDirtyForAccountIcons({ ctx, account }){
	let subject = getTokenId({ ctx, account })

	if(!subject)
		return

	ctx.db.cache.todos.createOne({
		data: {
			task: 'account.icons',
			subject
		}
	})
}