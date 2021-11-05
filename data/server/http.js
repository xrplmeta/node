import Router from '@koa/router'
import { parseURIComponent as parsePairURIComponent } from '../../common/pair.js'
import * as procedures from './procedures.js'


export default class extends Router{
	constructor(ctx){
		super()

		this.ctx = ctx

		this.get(
			'/currencies', 
			this.wrappedProcedure('currencies')
		)

		this.get(
			'/exchanges/:base/:quote/:format', 
			this.wrappedProcedure(
				'exchanges', 
				parameters => ({
					...parameters,
					base: parsePairURIComponent(parameters.base),
					quote: parsePairURIComponent(parameters.quote),
				})
			)
		)
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

				ctx.body = await procedures[name]({...this.ctx, parameters})
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
}