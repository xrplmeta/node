import { unixNow } from '@xrplmeta/common/lib/time.js'
import { currencyHexToUTF8, currencyUTF8ToHex } from '@xrplmeta/common/lib/xrpl.js'
import { keySort, decimalCompare } from '@xrplmeta/common/lib/data.js'
import Decimal from '@xrplmeta/common/lib/decimal.js'

const candlestickIntervals = {
	'5m': 60 * 5,
	'15m': 60 * 15,
	'1h': 60 * 60,
	'4h': 60 * 60 * 4,
	'1d': 60 * 60 * 24,
}


export async function currencies(ctx){
	let limit = ctx.parameters.limit || 100
	let offset = ctx.parameters.offset || 0
	let minTrustlines = ctx.parameters.min_trustlines || 100
	let filter = ctx.parameters.filter
	let total = ctx.cache.currencies.count()
	let currencies = ctx.cache.currencies.all({limit, offset, filter})
	let stacks = []


	for(let { currency, marketcap, volume } of currencies){
		let trustlines = ctx.cache.trustlines.all({
			currency,
			minAccounts: minTrustlines,
			limit: 3
		})

		if(trustlines.length === 0)
			continue

		stacks.push({
			currency,
			trustlines,
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

export async function trustline(ctx){
	let { currency, issuer, full } = ctx.parameters
	let { id, ...trustline } = ctx.cache.trustlines.get({currency, issuer}, full)
	
	if(!trustline){
		throw {message: `trustline not listed`, expose: true}
	}

	return trustline
}

export async function trustline_history(ctx){
	let { currency, issuer, start, end } = ctx.parameters
	let { id, ...trustline } = ctx.cache.trustlines.get({currency, issuer})

	if(!trustline){
		throw {message: `trustline not listed`, expose: true}
	}

	let stats = ctx.cache.stats.all(
		{id}, 
		start || 0,
		end || unixNow()
	)

	return stats
}

export async function exchanges(ctx){
	let { base, quote, format, start, end } = ctx.parameters
	let baseId = base.currency !== 'XRP'
		? ctx.cache.trustlines.get(base)?.id
		: null
	let quoteId = quote.currency !== 'XRP'
		? ctx.cache.trustlines.get(quote)?.id
		: null

	if(baseId === undefined || quoteId === undefined)
		throw {message: 'symbol not listed', expose: true}


	if(format === 'raw'){
		//todo
	}else{
		if(!candlestickIntervals[format]){
			throw {
				message: `format not available - available formats: raw, ${Object.keys(candlestickIntervals).join(', ')}`, 
				expose: true
			}
		}

		return ctx.cache.candles.all(
			{
				base: baseId, 
				quote: quoteId, 
				interval: candlestickIntervals[format]
			},
			start,
			end
		)
	}
}