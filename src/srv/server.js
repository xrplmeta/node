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

	koa.use(websocket())
	koa.use(async (ctx, next) => {
		ctx.req.on('error', error => {
			log.debug(`client error: ${error.message}`)
		})

		if(ctx.ws){
			ctx.req.socket.ignoreTimeout = true
			ws.registerSocket(await ctx.ws())
		}else{
			return await next(ctx)
		}
	})

	koa.use(json({ pretty: true }))
	koa.use(router.routes(), router.allowedMethods())

	koa.listen(ctx.config.server.port)
		.on('clientError', (error, socket) => {
			if(error.code === 'ERR_HTTP_REQUEST_TIMEOUT' && socket.ignoreTimeout)
				return

			log.debug(`client error:`, error)
			socket.destroy()
		})
		.on('error', error => {
			log.warn(`server error: ${error.message}`)
		})


	log.info(`listening on port ${ctx.config.server.port}`)

	await new Promise(resolve => {
		koa.on('close', resolve)
	})
}