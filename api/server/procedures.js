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
	let search = ctx.parameters.search
	let trustlines = await ctx.datasets.trustlines.get()
	let stacks = []
	let total = 0
	let now = unixNow()

	for(let trustline of trustlines){
		let formatted = formatTrustline(ctx, trustline, true)
		let stack = stacks.find(stack => stack.currency === formatted.currency)

		if(!stack){
			stack = {
				currency: formatted.currency,
				trustlines: [],
				stats: {
					volume: new Decimal(0),
					marketcap: new Decimal(0)
				}
			}

			stacks.push(stack)
		}

		stack.trustlines.push(formatted)

		stack.stats.volume = stack.stats.volume.plus(trustline.stats.volume || 0)
		stack.stats.marketcap = stack.stats.marketcap.plus(trustline.stats.marketcap || 0)
	}

	stacks = keySort(
		stacks, 
		stack => stack.stats.volume || new Decimal(0), 
		decimalCompare
	)
		.reverse()

	for(let stack of stacks){
		stack.count = stack.trustlines.length
		stack.trustlines = keySort(
			stack.trustlines,
			trustline => Decimal.sum(
				trustline.stats.volume || 0, 
				(trustline.stats.trustlines || 0) / 1000
			), 
			decimalCompare
		)
			.reverse()
			.filter((trustline, i) => i < 3 
				|| trustline.stats.trustlines >= minTrustlines)
	}

	if(search){
		stacks = stacks.filter(stack => {
			if(stack.currency.toLowerCase().startsWith(search.toLowerCase()))
				return true
		})
	}

	total = stacks.length

	if(limit)
		stacks = stacks.slice(offset, offset + limit)


	return {currencies: stacks, count: total}
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

	if(base.currency !== 'XRP' && !ctx.repo.trustlines.get(base))
		throw {message: 'symbol not listed', expose: true}

	if(quote.currency !== 'XRP' && !ctx.repo.trustlines.get(quote))
		throw {message: 'symbol not listed', expose: true}

	end = end || unixNow()

	if(format === 'raw'){

	}else{
		if(!candlestickIntervals[format]){
			throw {
				message: `This format is not available. Available formats are: raw, ${Object.keys(candlestickIntervals).join(', ')}`, 
				expose: true
			}
		}

		let candles = await ctx.datasets.exchanges.get(base, quote, format)

		if(start && end){
			let filtered = candles
				.filter(candle => candle.t >= start && candle.t <= end)

			if(filtered.length === 0)
				return candles.slice(-1)
			else
				return filtered
		}else
			return candles
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