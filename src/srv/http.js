import Router from '@koa/router'
import log from '@mwni/log'
import * as procedures from './api.js'


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
		'/tokens',
		async svc => {
			await handle({
				ctx,
				svc,
				procedure: 'tokens',
				args: {
					...svc.query,
					sources: svc.query.sources !== undefined,
					changes: svc.query.changes !== undefined,
					decode_currency: svc.query.decode_currency !== undefined,
				}
			})
		}
	)

	router.get(
		'/token/:token',
		async svc => {
			await handle({
				ctx,
				svc,
				procedure: 'token',
				args: {
					token: parseTokenURI(svc.params.token),
					sources: svc.query.sources !== undefined,
					decode_currency: svc.query.decode_currency !== undefined,
				}
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
					...parseRange(svc.query)
				}
			})
		}
	)

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

function parseRange({ sequence_start, sequence_end, sequence_interval, time_start, time_end, time_interval }){
	let range = {}

	if(sequence_start){
		range.sequence = {
			start: parseInt(sequence_start),
			end: sequence_end
				? parseInt(sequence_end)
				: undefined
		}

		if(sequence_interval)
			range.sequence.interval = parseInt(sequence_interval)
	}else if(time_start){
		range.time = {
			start: parseInt(time_start),
			end: time_end
				? parseInt(time_end)
				: undefined
		}

		if(time_interval)
			range.time.interval = parseInt(time_interval)
	}

	return range
}