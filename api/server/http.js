import Router from '@koa/router'
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
			'/token/:token', 
			this.wrappedProcedure(
				'token', 
				parameters => ({
					...parameters,
					...this.parseTokenURI(parameters.token),
					full: parameters.hasOwnProperty('full')
				})
			)
		)

		this.get(
			'/token/:token/history', 
			this.wrappedProcedure(
				'token_history', 
				parameters => ({
					...parameters,
					...this.parseTokenURI(parameters.token)
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

	parseTokenURI(uri){
		let [currency, issuer] = uri.split(':')

		return {
			currency,
			issuer
		}
	}

	wrappedProcedure(name, transformParameters){
		return async ctx => {
			if(!procedures[name]){
				ctx.throw(404)
				return
			}

			try{
				let parameters = {
					...ctx.query, 
					...ctx.params
				}

				if(transformParameters)
					parameters = transformParameters(parameters)

				ctx.body = await procedures[name]({
					...this.ctx, 
					parameters
				})
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