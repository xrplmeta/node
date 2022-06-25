import Router from '@koa/router'
import log from '@mwni/log'
import * as procedures from './procedures.js'


export function createRouter({ ctx }){
	let router = new Router()

	router.get(
		'/server',
		async svc => {
			await handle({
				ctx,
				svc,
				procedure: 'server_info'
			})
		}
	)

	/*router.get(
		'/tokens', 
		this.wrappedProcedure('tokens')
	)

	router.get(
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

	router.get(
		'/token/:token/:metric/:timeframe', 
		this.wrappedProcedure(
			'token_series', 
			parameters => ({
				...parameters,
				token: this.parseTokenURI(parameters.token)
			})
		)
	)*/

	return router
}


async function handle({ ctx, svc, procedure, args = {} }){
	if(!procedures[procedure]){
		svc.throw(404)
		return
	}

	try{
		svc.body = await procedures[procedure]({
			...args,
			ctx,
		})
	}catch(e){
		if(e.expose){
			delete e.expose

			svc.status = 400
			svc.body = e
		}else{
			svc.status = 500
			log.warn(`internal error while handling procedure "${procedure}":`)
			log.warn(e.stack)
			log.warn(`args:`, args)
		}
	}
}


function parseTokenURI(uri){
	let [currency, issuer] = uri.split(':')

	return {
		currency,
		issuer
	}
}