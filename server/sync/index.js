import * as tokens from './tokens.js'
import * as tokenExchanges from './tokenExchanges.js'
import * as tokenSnapshots from './tokenSnapshots.js'
import { wait, unixNow } from '@xrplworks/time'
import log from '../../lib/log.js'
import initCache from '../../lib/cache/index.js'
import { accumulate as accumulateUpdates } from '../../lib/status.js'


export function willRun(config){
	return !!config.server
}

export async function run({ config, repo }){
	let cache = initCache(config)
	let ctx = {config, repo, cache}

	try{
		if(cache.newlyCreated){
			allocate(ctx)
		}else{
			if(Object.keys(cache.heads.all()).length === 0)
				throw 'incomplete'
			
			if(cache.version !== repo.version)
				throw 'version mismatch'
		}
	}catch(e){
		log.error(`caching database corrupted: ${e}`)
		log.info(`wiping cache, then restarting`)

		cache.wipe()
		process.exit(0)
	}

	syncRoutine(ctx)
	refreshRoutine(ctx)

	process.send({signal: 'server:synced'})
}

function allocate(ctx){
	let repoHeads = ctx.repo.heads.all()

	log.time(`sync.prepare`, `building caching database`)

	tokenExchanges.allocate.call(ctx, repoHeads)
	tokenSnapshots.allocate.call(ctx, repoHeads)
	tokens.allocate.call(ctx, repoHeads)

	ctx.cache.version = ctx.repo.version

	log.time(`sync.prepare`, `built complete caching database in %`)

	ctx.cache.heads.set(repoHeads)
}

async function syncRoutine(ctx){
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


		/*log.time(
			`sync.update`,
			`tracked updates:`,
			Object.entries(ranges)
				.map(([key, [o, n]]) => `${key} ${o} -> ${n}`)
				.join(`, `)
		)*/
		
		try{
			ctx.cache.tx(() => {
				//log.time(`sync.update.exchanges`)
				tokenExchanges.register.call(ctx, {ranges, affected})
				//log.time(`sync.update.exchanges`, `applied exchanges in %`)

				//log.time(`sync.update.stats`)
				tokenSnapshots.register.call(ctx, {ranges, affected})
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

		//log.time(`sync.update`, `committed updates in %`)

		for(let [key, [o, n]] of Object.entries(ranges)){
			accumulateUpdates({[`+% ${key}`]: n-o})
		}
	}
}

async function refreshRoutine(ctx){
	while(true){
		await wait(10000)

		let outdatedTokens = ctx.cache.tokens.all({updatedBefore: unixNow() - 60 * 15})

		if(outdatedTokens.length > 0){
			let failed = 0
			
			log.time(`sync.tokensupdate`)

			try{
				for(let { id } of outdatedTokens){
					try{
						tokens.update.call(ctx, id)
					}catch{
						failed++
					}
				}
			}catch(e){
				log.error(`failed to commit token updates:\n`, e)
			}

			log.time(`sync.tokensupdate`, `updated ${outdatedTokens.length - failed} / ${outdatedTokens.length} stale tokens in %`)
		}
	}
}