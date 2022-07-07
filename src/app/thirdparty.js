import log from '@mwni/log'
import { spawn } from 'nanotasks'
import { open as openDB } from '../db/index.js'
import { startCrawlers } from '../etl/thirdparty/index.js'


export async function run({ config }){
	await spawn(':runThirdPartyCrawlers', {
		ctx: { 
			config, 
			log,
		}
	})
}


export async function runThirdPartyCrawlers({ ctx }){
	if(ctx.log)
		log.pipe(ctx.log)


	return await startCrawlers({
		ctx: {
			...ctx,
			db: openDB({ ctx })
		}
	})
}