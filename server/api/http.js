import Router from '@koa/router'
import * as methods from './methods.js'


export default class extends Router{
	constructor(ctx){
		super()

		this.ctx = ctx

		this.get(
			'/tokens', 
			this.wrappedProcedure('tokens')
		)

		this.get(
			'/token/:token', 
			this.wrappedProcedure(
				'token', 
				parameters => ({
					...parameters,
					token: this.parseTokenURI(parameters.token),
					full: parameters.hasOwnProperty('full')
				})
			)
		)

		this.get(
			'/token/:token/:metric/:timeframe', 
			this.wrappedProcedure(
				'token_series', 
				parameters => ({
					...parameters,
					token: this.parseTokenURI(parameters.token)
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
			if(!methods[name]){
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

				ctx.body = await methods[name]({
					...this.ctx, 
					parameters
				})
			}catch(e){
				let { expose, ...error } = e

				console.log(e)

				if(expose){
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