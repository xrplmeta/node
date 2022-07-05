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

	router.get(
		'/token/:token/series/:metric',
		async svc => {
			await handle({
				ctx,
				svc,
				procedure: 'token_series',
				args: {
					token: parseTokenURI(svc.params.token),
					metric: svc.params.metric,
					interval: svc.query.interval,
					...parseRange(svc.query)
				}
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

function parseRange({ sequence_start, sequence_end, time_start, time_end }){
	let range = {}

	if(sequence_start){
		range.sequence = {
			start: parseInt(sequence_start),
			end: sequence_end
				? parseInt(sequence_end)
				: undefined
		}
	}else if(time_start){
		range.time = {
			start: parseInt(time_start),
			end: time_end
				? parseInt(time_end)
				: undefined
		}
	}

	return range
}