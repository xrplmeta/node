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
	let trustlines = await ctx.datasets.trustlines.get()
	let stacks = []
	let now = unixNow()

	for(let trustline of trustlines){
		let enriched = await enrichTrustline(ctx, trustline)
		let stack = stacks.find(stack => stack.currency === enriched.currency)

		if(!stack){
			stack = {
				currency: enriched.currency,
				trustlines: [],
				stats: {
					volume: new Decimal(0),
					marketcap: new Decimal(0),
					liquidity: new Decimal(0),
				}
			}

			stacks.push(stack)
		}

		stack.trustlines.push(enriched)

		stack.stats.volume = stack.stats.volume.plus(enriched.stats.volume || 0)
		stack.stats.marketcap = stack.stats.marketcap.plus(enriched.stats.marketcap || 0)
		stack.stats.liquidity = stack.stats.liquidity.plus(enriched.stats.liquidity || 0)
	}

	keySort(
		stacks, 
		stack => stack.stats.volume, 
		decimalCompare
	)
	stacks.reverse()

	for(let stack of stacks){
		stack.count = stack.trustlines.length

		keySort(
			stack.trustlines,
			trustline => trustline.stats.volume,
			decimalCompare
		)
		stack.trustlines.reverse()
		stack.trustlines = stack.trustlines.slice(0, 3)
	}

	return stacks
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

async function enrichTrustline(ctx, trustline){
	let candles = await exchanges({
		...ctx,
		parameters: {
			base: trustline, 
			quote: {currency: 'XRP'}, 
			format: '1d',
			start: unixNow - 60*60*24,
			end: unixNow
		}
	})
	let enriched = {
		...trustline,
		currency: currencyHexToUTF8(trustline.currency),
		meta: {
			currency: collapseMetas(trustline.meta.currency, ctx.parameters.source_priority),
			issuer: collapseMetas(trustline.meta.issuer, ctx.parameters.source_priority),
			emailHash: undefined,
			socials: undefined
		},
		stats: {
			...trustline.stats,
			supply: undefined
		}
	}

	if(candles.length > 0){
		let lastCandle = candles[candles.length - 1]

		enriched.stats = {
			...enriched.stats,
			price: lastCandle.c,
			marketcap: Decimal.mul(enriched.stats.supply || 0, lastCandle.c),
			volume: Decimal.sum(...candles.map(candle => candle.v))
		}
	}

	return enriched
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