import * as candles from './sync/candles.js'
import * as trustlines from './sync/trustlines.js'
import * as currencies from './sync/currencies.js'
import * as stats from './sync/stats.js'
import { Logger } from '@xrplmeta/common/lib/log.js'

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