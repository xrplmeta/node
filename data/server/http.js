import Koa from 'koa'
import Router from '@koa/router'
import { log } from '../../common/logging.js'
import { parseURIComponent as parsePairURIComponent } from '../../common/pair.js'
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
		this.router.get('/exchanges/:base/:quote/:format', this.wrappedProcedure('exchanges', parameters => ({
			...parameters,
			base: parsePairURIComponent(parameters.base),
			quote: parsePairURIComponent(parameters.quote),
		})))
	}

	wrappedProcedure(name, transformParameters){
		return async ctx => {
			if(!procedures[name]){
				ctx.throw(404)
				return
			}

			try{
				let parameters = {...ctx.query, ...ctx.params}

				if(transformParameters)
					parameters = transformParameters(parameters)

				ctx.body = await procedures[name](this.server.makeCtx(parameters))
			}catch(error){
				ctx.status = 400

				if(error.expose){
					ctx.body = error
				}else{
					console.error(error)
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