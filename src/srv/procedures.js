export function server_info({ ctx }){
	let firstLedger = ctx.db.ledgers.readOne({
		orderBy: {
			sequence: 'asc'
		}
	})

	let lastLedger = ctx.db.ledgers.readOne({
		orderBy: {
			sequence: 'desc'
		}
	})

	return {
		available_ledgers: {
			newest: {
				sequence: lastLedger.sequence,
				time: lastLedger.closeTime,
			},
			oldest: {
				sequence: firstLedger.sequence,
				time: firstLedger.closeTime,
			}
		}
	}
}


/*import { collapseMetas } from './utils.js'

const allowedSorts = [
	'popular',
	'marketcap',
	'price_day',
	'price_week',
	'volume_week', 
	'volume_day', 
	'trustlines',
	'trustlines_day',
	'trustlines_week',
]

const metricDivisions = {
	market: ['candle', 'price', 'volume'],
	snapshot: ['trustlines', 'marketcap', 'supply', 'liquidity', 'distribution']
}

const collapseToken = (token, prios) => ({
	...token,
	meta: {
		currency: collapseMetas(
			token.meta.currency, 
			prios
		),
		issuer: collapseMetas(
			token.meta.issuer,
			prios
		)
	}
})



export async function tokens(ctx){
	let limit = Math.min(1000, ctx.parameters.limit || 100)
	let offset = ctx.parameters.offset || 0
	let sort = ctx.parameters.sort || allowedSorts[0]
	let trusted = ctx.parameters.trusted
	let search = ctx.parameters.search
	let total = ctx.cache.tokens.count()
	let sourcePriorities = ctx.config.server.sourcePriorities


	if(!allowedSorts.includes(sort))
		throw {message: `sort "${sort}" is not allowed. possible values are: ${allowedSorts.join(', ')}`, expose: true}


	return ctx.cache.tokens.all({limit, offset, sort, trusted, search})
		.map(token => collapseToken(token, sourcePriorities))
}


export async function token(ctx){
	let { token: { currency, issuer }, full } = ctx.parameters
	let token = ctx.cache.tokens.get({currency, issuer}, full)
	
	if(!token){
		throw {message: `token not listed`, expose: true}
	}

	return full
		? token
		: collapseToken(token, ctx.config.server.sourcePriorities)
}


export async function token_series(ctx){
	let { token: { currency, issuer }, metric, timeframe, start, end } = ctx.parameters
	let token = ctx.cache.tokens.get({currency, issuer})
	let division = Object.keys(metricDivisions)
		.find(key => metricDivisions[key].includes(metric))

	if(!token){
		throw {
			message: `token not listed`, 
			expose: true
		}
	}

	if(!division){
		throw {
			message: `metric "${metric}" is not available. available metrics are: ${
				[...metricDivisions.market, ...metricDivisions.snapshot].join(', ')
			}`, 
			expose: true
		}
	}

	if(!ctx.config.server[`${division}Timeframes`][timeframe]){
		throw {
			message: `timeframe "${timeframe}" not available - available timeframes are: ${
				Object.keys(ctx.config.server[`${division}Timeframes`]).join(', ')
			}`, 
			expose: true
		}
	}

	if(division === 'market'){
		let candles = ctx.cache.tokenCandles.all(
			{
				base: token.id, 
				quote: null, 
				timeframe: ctx.config.server.marketTimeframes[timeframe]
			},
			start,
			end
		)

		if(metric === 'price'){
			return candles.map(candle => ({
				t: candle.t,
				v: candle.c
			}))
		}else if(metric === 'volume'){
			return candles.map(candle => ({
				t: candle.t,
				v: candle.v
			}))
		}else{
			return candles
		}
	}else if(division === 'snapshot'){
		let stats = ctx.cache.tokenSnapshots.all(
			{
				token: token.id, 
				timeframe: ctx.config.server.snapshotTimeframes[timeframe]
			}, 
			start,
			end
		)

		return stats.map(stat => ({
			t: stat.date,
			v: stat[metric]
		}))
	}
}*/