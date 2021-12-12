import Koa from 'koa'
import websocket from 'koa-easy-ws'
import { Logger } from '@xrplmeta/common/lib/log.js'
import { wait } from '@xrplmeta/common/lib/time.js'
import HTTPRouter from './http.js'
import WSManager from './ws.js'

const log = new Logger({name: 'server', color: 'cyan'})

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
	koa.listen(config.api.port)

	log.info(`listening on port ${config.api.port}`)
}