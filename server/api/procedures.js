import { unixNow } from '@xrplmeta/utils'
import { collapseMetas } from './utils.js'


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
	stats: ['trustlines', 'marketcap', 'supply', 'liquidity', 'distribution']
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


export async function currencies(ctx){
	let limit = ctx.parameters.limit || 100
	let offset = ctx.parameters.offset || 0
	let minTokens = ctx.parameters.min_tokens || 100
	let filter = ctx.parameters.filter
	let total = ctx.cache.currencies.count()
	let currencies = ctx.cache.currencies.all({limit, offset, filter})
	let stacks = []


	for(let { currency, marketcap, volume } of currencies){
		let tokens = ctx.cache.tokens.all({
			currency,
			minAccounts: minTokens,
			limit: 3
		})

		if(tokens.length === 0)
			continue

		stacks.push({
			currency,
			tokens,
			stats: {
				marketcap: marketcap.toString(),
				volume: volume.toString()
			}
		})
	}

	return {
		currencies: stacks, 
		count: total
	}
}

export async function tokens(ctx){
	let limit = Math.min(1000, ctx.parameters.limit || 100)
	let offset = ctx.parameters.offset || 0
	let sort = ctx.parameters.sort || allowedSorts[0]
	let trusted = ctx.parameters.trusted
	let search = ctx.parameters.search
	let total = ctx.cache.tokens.count()
	let sourcePriorities = ctx.config.meta.sourcePriorities

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

	return collapseToken(token, ctx.config.meta.sourcePriorities)
}


export async function token_metric(ctx){
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
				[...metricDivisions.market, ...metricDivisions.stats].join(', ')
			}`, 
			expose: true
		}
	}

	if(!ctx.config.tokens[division].timeframes[timeframe]){
		throw {
			message: `timeframe "${timeframe}" not available - available timeframes are: ${
				Object.keys(ctx.config.tokens[division].timeframes).join(', ')
			}`, 
			expose: true
		}
	}

	if(division === 'market'){
		let candles = ctx.cache.candles.all(
			{
				base: token.id, 
				quote: null, 
				timeframe: ctx.config.tokens.market.timeframes[timeframe]
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
	}else if(division === 'stats'){
		let stats = ctx.cache.stats.all(
			{
				token: token.id, 
				timeframe: ctx.config.tokens.stats.timeframes[timeframe]
			}, 
			start,
			end
		)

		return stats.map(stat => ({
			t: stat.date,
			v: stat[metric]
		}))
	}
}