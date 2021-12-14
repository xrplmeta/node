import * as candles from './sync/candles.js'
import * as trustlines from './sync/trustlines.js'
import * as currencies from './sync/currencies.js'
import * as stats from './sync/stats.js'
import { Logger } from '@xrplmeta/common/lib/log.js'
import { wait } from '@xrplmeta/common/lib/time.js'

const log = new Logger({name: 'sync'})


export default async ctx => {
	if(ctx.cache.isEmpty()){
		allocate(ctx)
	}else{
		try{
			if(Object.keys(ctx.cache.heads.all()).length === 0)
				throw 'incomplete'
		}catch(e){
			log.error(`caching database corrupted (${e})\n -> recreating from scratch`)

			ctx.cache.wipe()
			allocate(ctx)
		}
	}

	loop(ctx)
}

function allocate(ctx){
	let repoHeads = ctx.repo.heads.all()

	log.time(`sync.prepare`, `building caching database`)

	candles.allocate.call(ctx, repoHeads)
	trustlines.allocate.call(ctx, repoHeads)
	currencies.allocate.call(ctx, repoHeads)
	stats.allocate.call(ctx, repoHeads)

	log.time(`sync.prepare`, `built caching database in %`)

	ctx.cache.heads.set(repoHeads)
}

async function loop(ctx){
	while(true){
		let cacheHeads = ctx.cache.heads.all()
		let repoHeads = ctx.repo.heads.all()
		let updates = {}

		for(let [k, i] of Object.entries(repoHeads)){
			if(i > cacheHeads[k]){
				updates[k] = [cacheHeads[k], i]
			}
		}

		if(Object.keys(updates).length === 0){
			await wait(100)
			continue
		}

		log.time(
			`sync.update`,
			`tracked updates:`,
			Object.entries(updates)
				.map(([key, [o, n]]) => `${key} ${o}-${n}`)
				.join(`, `)
		)
		
		try{
			ctx.cache.tx(() => {
				candles.register.call(ctx, updates)
				trustlines.register.call(ctx, updates)
				currencies.register.call(ctx, updates)
				stats.register.call(ctx, updates)

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