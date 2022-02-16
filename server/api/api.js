import Koa from 'koa'
import websocket from 'koa-easy-ws'
import log from '@xrplmeta/log'
import { wait } from '@xrplmeta/utils'
import HTTPRouter from './http.js'
import WSManager from './ws.js'


log.config({
	name: 'api',
	color: 'green'
})


export default ({config, cache}) => {
	let koa = new Koa()
	let router = new HTTPRouter({cache, config})
	let ws = new WSManager({cache, config})

	koa.use(websocket())
	koa.use(async (ctx, next) => {
		if(ctx.ws){
			ws.register(await ctx.ws())
		}else{
			return await next(ctx)
		}
	})

	koa.use(router.routes(), router.allowedMethods())
	koa.listen(config.server.port)

	log.info(`listening on port ${config.server.port}`)
}