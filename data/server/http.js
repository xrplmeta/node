import Koa from 'koa'
import Router from '@koa/router'
import { log } from '../../common/logging.js'
import * as procedures from './procedures.js'


export default class{
	constructor(server){
		this.server = server
		this.koa = new Koa()
		this.router = new Router()
		this.log = log.for('http', 'green')

		this.setupRoutes()
	}

	setupRoutes(){
		this.router.get('/currencies', this.wrappedProcedure('currencies'))
	}

	wrappedProcedure(name){
		return async ctx => {
			if(!procedures[name]){
				ctx.throw(404)
				return
			}

			try{
				ctx.body = await procedures[name](this.server.makeCtx({...ctx.query, ...ctx.params}))
			}catch(error){
				ctx.status = 400

				if(error.expose){
					ctx.body = error
				}
			}
		}
	}

	listen(port){
		this.koa.use(this.router.routes(), this.router.allowedMethods())
		this.koa.listen(port)

		this.log(`listening on port ${port}`)
	}
}