import log from '@mwni/log'
import Koa from 'koa'
import websocket from 'koa-easy-ws'
import json from 'koa-json'
import { createRouter } from './http.js'
import { createManager } from './ws.js'


export async function startServer({ ctx }){
	let koa = new Koa()
	let router = createRouter({ ctx })
	let ws = createManager({ ctx })

	koa.use(json({ pretty: true }))
	koa.use(websocket())
	koa.use(async (ctx, next) => {
		if(ctx.ws){
			ws.register(await ctx.ws())
		}else{
			return await next(ctx)
		}
	})

	koa.use(router.routes(), router.allowedMethods())
	koa.listen(ctx.config.server.port)

	log.info(`listening on port ${ctx.config.server.port}`)

	await new Promise(resolve => {
		koa.on('close', resolve)
	})
}