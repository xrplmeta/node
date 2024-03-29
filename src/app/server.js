import log from '@mwni/log'
import { spawn } from '@mwni/workers'
import { openDB } from '../db/index.js'
import { startServer } from '../srv/server.js'


export async function run({ ctx }){
	if(!ctx.config.api){
		log.warn(`config is missing [API] stanza: disabling server`)
		return
	}

	await spawn(':runServer', { ctx })
}


export async function runServer({ ctx }){
	if(ctx.log)
		log.pipe(ctx.log)

	log.info('starting server')

	return await startServer({
		ctx: {
			...ctx,
			db: await openDB({ ctx })
		}
	})
}