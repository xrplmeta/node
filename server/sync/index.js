import * as exchanges from './exchanges.js'
import * as tokens from './tokens.js'
import * as stats from './stats.js'
import { wait, unixNow } from '@xrplworks/time'
import log from '../../lib/log.js'
import initCache from '../../lib/cache/index.js'


export function willRun(config){
	return !!config.server
}

export async function run({ config, repo }){
	let cache = initCache(config)
	let ctx = {config, repo, cache}

	try{
		if(cache.isEmpty()){
			allocate(ctx)
		}else{
			if(Object.keys(cache.heads.all()).length === 0)
				throw 'incomplete'
		}
	}catch(e){
		log.error(`caching database corrupted (${e}) -> recreating from scratch`)

		cache.wipe()
		allocate(ctx)
	}

	loop(ctx)
}

function allocate(ctx){
	let repoHeads = ctx.repo.heads.all()

	log.time(`sync.prepare`, `building caching database`)

	exchanges.allocate.call(ctx, repoHeads)
	stats.allocate.call(ctx, repoHeads)
	tokens.allocate.call(ctx, repoHeads)

	log.time(`sync.prepare`, `built complete caching database in %`)

	ctx.cache.heads.set(repoHeads)
}

async function loop(ctx){
	let cacheHeads
	let repoHeads

	while(true){
		try{
			cacheHeads = ctx.cache.heads.all()
			repoHeads = ctx.repo.heads.all()
		}catch{
			await wait(1000)
			continue
		}

		let ranges = {}
		let affected = []

		for(let [k, i] of Object.entries(repoHeads)){
			if(i > cacheHeads[k]){
				let newRows = ctx.repo.heads.diff(k, cacheHeads[k], i)

				ranges[k] = [cacheHeads[k], i]

				switch(k){
					case 'tokens':
						for(let row of newRows){
							affected.push({
								type: {A: 'account', T: 'token'}[row.type],
								id: row.subject,
								context: 'self'
							})
						}
						break

					case 'exchanges':
						for(let row of newRows){
							if(row.base){
								affected.push({
									type: 'token',
									id: row.base,
									context: 'exchange'
								})
							}

							if(row.quote){
								affected.push({
									type: 'token',
									id: row.quote,
									context: 'exchange'
								})
							}
						}
						break

					case 'metas':
						for(let row of newRows){
							affected.push({
								type: {A: 'account', T: 'token'}[row.type],
								id: row.subject,
								context: 'meta'
							})
						}
						break

					case 'stats':
						for(let row of newRows){
							affected.push({
								type: 'token',
								id: row.token,
								context: 'stats'
							})
						}
						break
				}
			}
		}

		if(affected.length === 0){
			let outdatedTokens = ctx.cache.tokens.all({updatedBefore: unixNow() - 60 * 60})

			if(outdatedTokens.length > 0){
				log.time(`sync.tokensupdate`, `updating ${outdatedTokens.length} outdated tokens`)

				try{
					ctx.cache.tx(() => {
						for(let { id } of outdatedTokens){
							tokens.update.call(ctx, id)
						}
					})
				}catch(e){
					log.error(`failed to commit token updates:\n`, e)
				}

				log.time(`sync.tokensupdate`, `updated outdated tokens in %`)
			}

			await wait(100)
			continue
		}

		let uniqueAffected = []

		for(let affect of affected){
			let existing = uniqueAffected.find(u => u.type === affect.type && u.id === affect.id)

			if(!existing){
				uniqueAffected.push(existing = {
					type: affect.type,
					id: affect.id,
					contexts: []
				})
			}

			if(!existing.contexts.includes(affect.context))
				existing.contexts.push(affect.context)
		}

		affected = uniqueAffected


		log.time(
			`sync.update`,
			`tracked updates:`,
			Object.entries(ranges)
				.map(([key, [o, n]]) => `${key} ${o} -> ${n}`)
				.join(`, `)
		)
		
		try{
			ctx.cache.tx(() => {
				//log.time(`sync.update.exchanges`)
				exchanges.register.call(ctx, {ranges, affected})
				//log.time(`sync.update.exchanges`, `applied exchanges in %`)

				//log.time(`sync.update.stats`)
				stats.register.call(ctx, {ranges, affected})
				//log.time(`sync.update.stats`, `applied stats in %`)

				//log.time(`sync.update.tokens`)
				tokens.register.call(ctx, {ranges, affected})
				//log.time(`sync.update.tokens`, `applied tokens in %`)

				ctx.cache.heads.set(repoHeads)
			})
		}catch(e){
			log.error(`failed to commit updates:\n`, e)
			await wait(1000)
			continue
		}

		log.time(`sync.update`, `committed updates in %`)
	}
}