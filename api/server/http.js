import Router from '@koa/router'
import { parseURIComponent as parsePairURIComponent } from '../../common/lib/pair.js'
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
			'/currency/:currency/stats', 
			this.wrappedProcedure('currency_stats')
		)

		this.get(
			'/trustline/:trustline', 
			this.wrappedProcedure(
				'trustline', 
				parameters => ({
					...parameters,
					...parsePairURIComponent(parameters.trustline),
					full: parameters.hasOwnProperty('full')
				})
			)
		)

		this.get(
			'/trustline/:trustline/history', 
			this.wrappedProcedure(
				'trustline_history', 
				parameters => ({
					...parameters,
					...parsePairURIComponent(parameters.trustline)
				})
			)
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
				if(error.expose){
					ctx.status = 400
					ctx.body = error
				}else{
					ctx.status = 500
					console.error(error)
				}
			}
		}
	}
}