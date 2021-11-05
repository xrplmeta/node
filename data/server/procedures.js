import { currencyHexToUTF8 } from '../../common/xrpl.js'
import { keySort, decimalCompare } from '../../common/data.js'

const candlestickIntervals = {
	'5m': 60 * 5,
	'15m': 60 * 15,
	'1h': 60 * 60,
	'4h': 60 * 60 * 4,
	'1d': 60 * 60 * 24,
}


export async function currencies(ctx){
	let currencies = ctx.datasets.currencies.get()

	if(!ctx.parameters.full){
		currencies = currencies.map(currency => ({
			...currency,
			currency: currencyHexToUTF8(currency.currency),
			meta: {
				currency: collapseMetas(currency.meta.currency, ctx.parameters.source_priority),
				issuer: collapseMetas(currency.meta.issuer, ctx.parameters.source_priority),
			}
		}))
	}

	currencies = keySort(
		currencies, 
		currency => currency.stats.liquidity, 
		decimalCompare
	)
		.reverse()

	return currencies
}

export async function exchanges(ctx){
	let { base, quote, format, start, end } = ctx.parameters
	let interval = candlestickIntervals[format]

	if(format !== 'raw'){
		if(!interval){
			throw {
				message: `This format is not available. Available formats are: raw, ${Object.keys(candlestickIntervals).join(', ')}`, 
				expose: true
			}
		}

		format = 'candlesticks'
	}


	let exchanges = await ctx.dataset('exchanges', {base, quote, format, interval})

	return exchanges
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