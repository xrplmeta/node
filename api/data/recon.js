import { log } from '@xrplmeta/common/lib/log.js'
import * as candles from './recon/candles.js'


export default async ctx => {
	try{
		let heads = ctx.cache.heads.all()
	}catch(e){
		log.info(`cache database corrupted, recreating from scratch...`)

		ctx.cache.wipe()
	}

	await candles.allocate(ctx)
}