import log from '@mwni/log'
import { spawn } from '@mwni/workers'
import { openDB } from '../db/index.js'
import { startCrawlers } from '../crawl/init.js'
import { createPool } from '../xrpl/nodepool.js'



export async function run({ ctx }){
	ctx = { 
			...ctx,
			xrpl: createPool(ctx.config.source.xrpls),
		}
	
	await spawn(':runCrawl', { ctx })
}


export async function runCrawl({ ctx }){
	if(ctx.log)
		log.pipe(ctx.log)

	log.info('starting crawlers')

	return await startCrawlers({
		ctx: {
			...ctx,
			db: await openDB({ ctx })
		}
	})
}