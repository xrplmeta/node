import { unixNow } from '../../common/time.js'
import { currencyHexToUTF8 } from '../../common/xrpl.js'
import { keySort, decimalCompare } from '../../common/data.js'
import Decimal from '../../common/decimal.js'

const candlestickIntervals = {
	'5m': 60 * 5,
	'15m': 60 * 15,
	'1h': 60 * 60,
	'4h': 60 * 60 * 4,
	'1d': 60 * 60 * 24,
}


export async function currencies(ctx){
	let currencies = await ctx.datasets.currencies.get()
	let list = []
	let now = unixNow()

	for(let currency of currencies){
		let candles = await exchanges({
			...ctx,
			parameters: {
				base: currency, 
				quote: {currency: 'XRP'}, 
				format: '1d',
				start: unixNow - 60*60*24,
				end: unixNow
			}
		})
		let modified = {
			...currency,
			currency: currencyHexToUTF8(currency.currency),
			meta: {
				currency: collapseMetas(currency.meta.currency, ctx.parameters.source_priority),
				issuer: collapseMetas(currency.meta.issuer, ctx.parameters.source_priority),
				emailHash: undefined,
				socials: undefined
			},
			stats: {
				...currency.stats,
				supply: undefined
			}
		}

		if(candles.length > 0){
			let lastCandle = candles[candles.length - 1]

			modified.stats = {
				...modified.stats,
				price: lastCandle.c,
				cap: Decimal.mul(modified.stats.supply || 0, lastCandle.c),
				volume: Decimal.sum(...candles.map(candle => candle.v))
			}
		}

		list.push(modified)
	}

	list = keySort(
		list, 
		currency => currency.stats.volume, 
		decimalCompare
	)
		.reverse()

	return list
}

export async function exchanges(ctx){
	let { base, quote, format, start, end } = ctx.parameters
 
	if(format === 'raw'){

	}else{
		if(!candlestickIntervals[format]){
			throw {
				message: `This format is not available. Available formats are: raw, ${Object.keys(candlestickIntervals).join(', ')}`, 
				expose: true
			}
		}

		let candles = await ctx.datasets.exchanges.get(base, quote, format)

		return candles
	}
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