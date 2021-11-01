import Koa from 'koa'
import Router from '@koa/router'
import placeholders from './placeholders.js'

export default class Server{
	constructor(){
		this.koa = new Koa()
		this.router = new Router()

		this.setupRoutes()
	}

	setupRoutes(){
		this.router.get('/assets', async ctx => {
			ctx.body = placeholders.assets
		})
	}

	listen(port){
		this.koa.use(this.router.routes(), this.router.allowedMethods())
		this.koa.listen(port)
	}
}