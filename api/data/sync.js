import * as candles from './sync/candles.js'
import * as trustlines from './sync/trustlines.js'
import * as currencies from './sync/currencies.js'
import { Logger } from '@xrplmeta/common/lib/log.js'

const log = new Logger({name: 'sync'})


export default async ctx => {
	log.info(`preparing caching database`)

	try{
		var cacheHeads = ctx.cache.heads.all()
	}catch(e){
		log.info(`caching database corrupted, recreating from scratch...`)

		ctx.cache.wipe()
	}

	let repoHeads = ctx.repo.heads.all()

	if(!cacheHeads.Exchanges){
		candles.allocate.call(ctx, repoHeads)
	}

	if(!cacheHeads.Trustlines){
		trustlines.allocate.call(ctx, repoHeads)
	}

	if(!cacheHeads.Currencies){
		trustlines.allocate.call(ctx, repoHeads)
	}

	log.info(`caching database is ready`)
}