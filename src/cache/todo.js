import { getAccountId, getTokenId } from '../db/helpers/common.js'

export function markCacheDirtyForAccountProps({ ctx, account }){
	if(ctx.backwards)
		return

	ctx.db.cache.todos.createOne({
		data: {
			task: 'account.props',
			subject: getAccountId({ ctx, account })
		}
	})
}

export function markCacheDirtyForTokenProps({ ctx, token }){
	if(ctx.backwards)
		return

	ctx.db.cache.todos.createOne({
		data: {
			task: 'token.props',
			subject: getTokenId({ ctx, token })
		}
	})
}

export function markCacheDirtyForTokenMetrics({ ctx, token, metrics }){
	if(ctx.backwards)
		return

	let subject = getTokenId({ ctx, token })

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

	ctx.db.cache.todos.createOne({
		data: {
			task: 'token.exchanges',
			subject: getTokenId({ ctx, token })
		}
	})
}

export function markCacheDirtyForTokenIcons({ ctx, token }){
	ctx.db.cache.todos.createOne({
		data: {
			task: 'token.icons',
			subject: getTokenId({ ctx, token })
		}
	})
}

export function markCacheDirtyForAccountIcons({ ctx, account }){
	ctx.db.cache.todos.createOne({
		data: {
			task: 'account.icons',
			subject: getAccountId({ ctx, account })
		}
	})
}