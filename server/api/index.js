import Koa from 'koa'
import websocket from 'koa-easy-ws'
import HTTPRouter from './http.js'
import WSManager from './ws.js'
import log from '../../lib/log.js'
import initCache from '../../lib/cache/index.js'


export function willRun(config){
	return !!config.server
}


export function run ({ config, repo }) {
	let cache = initCache(config)
	let koa = new Koa()
	let router = new HTTPRouter({cache, config})
	let ws = new WSManager({cache, config})
	let ctx = {config, repo, cache}

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