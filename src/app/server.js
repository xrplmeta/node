import log from '@mwni/log'
import { spawn } from 'multitasked'
import { open as openDB } from '../db/index.js'
import { startServer } from '../srv/server.js'


export async function run({ config }){
	if(!config.server){
		log.warn(`config is missing server stanza: disabling server`)
		return
	}

	await spawn(':runServer', {
		ctx: { 
			config, 
			log,
		}
	})
}


export async function runServer({ ctx }){
	if(ctx.log)
		log.pipe(ctx.log)

	log.info('starting server')

	return await startServer({
		ctx: {
			...ctx,
			db: openDB({ ctx })
		}
	})
}