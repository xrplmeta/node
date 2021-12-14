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
	let currencies = ctx.cache.currencies.all({limit, offset})
	let stacks = []


	for(let { currency, marketcap, volume } of currencies){
		let trustlines = ctx.cache.trustlines.all({
			currency,
			minAccounts: minTrustlines,
			limit: 3
		})

		stacks.push({
			currency,
			trustlines,
			stats: {
				marketcap: marketcap.toString(),
				volume: volume.toString()
			}
		})
	}

	return stacks
}

export async function currency_stats(ctx){
	let currency = currencyUTF8ToHex(ctx.parameters.currency)
	let trustlines = await ctx.datasets.trustlines.get()
	let selectedTrustlines = trustlines
		.filter(trustline => trustline.currency === currency)
	let stats = {
		volume: new Decimal(0),
		marketcap: new Decimal(0)
	}

	for(let trustline of selectedTrustlines){
		stats.volume = stats.volume.plus(trustline.stats.volume || 0)
		stats.marketcap = stats.marketcap.plus(trustline.stats.marketcap || 0)
	}

	return stats
}


export async function trustline(ctx){
	let { currency, issuer, full } = ctx.parameters
	let trustlines = await ctx.datasets.trustlines.get()
	let trustline = trustlines.find(trustline => 
		trustline.currency === currency && trustline.issuer === issuer)
	
	if(!trustline){
		throw {message: `trustline not listed`, expose: true}
	}

	return formatTrustline(ctx, trustline, !full)
}

export async function trustline_history(ctx){
	let { currency, issuer, start, end } = ctx.parameters
	let historicals = ctx.datasets.historicals.get({currency, issuer})

	return historicals
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
				message: `This format is not available. Available formats are: raw, ${Object.keys(candlestickIntervals).join(', ')}`, 
				expose: true
			}
		}

		return ctx.cache.candles.all(
			{
				base: baseId, 
				quoteId, 
				interval: candlestickIntervals[format]
			},
			start,
			end
		)
	}
}


function formatTrustline(ctx, trustline, minimal){
	let formatted = {
		...trustline,
		meta: {...trustline.meta}
	}

	delete formatted.id

	if(minimal){
		formatted.meta.currency = collapseMetas(trustline.meta.currency, ctx.parameters.source_priority),
		formatted.meta.issuer = collapseMetas(trustline.meta.issuer, ctx.parameters.source_priority)

		delete formatted.meta.issuer.emailHash
		delete formatted.meta.issuer.socials
		delete formatted.meta.issuer.description
	}

	return formatted
}

function collapseMetas(metas, sourcePriority){
	let collapsed = {}

	for(let [key, values] of Object.entries(metas)){
		if(Array.isArray(values)){
			let meta = values[0]

			if(meta.value)
				collapsed[key] = meta.value
		}else{
			collapsed[key] = collapseMetas(values, sourcePriority)
		}
	}

	return collapsed
}