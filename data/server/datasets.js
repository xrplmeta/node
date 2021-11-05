import { currencyHexToUTF8 } from '../../common/xrpl.js'
import { keySort, mapMultiKey, nestDotNotated } from '../../common/data.js'
import Decimal from '../../common/decimal.js'


export async function currencies(ctx){
	let trustlines = await ctx.repo.getTrustlines()
	let dataset = []


	for(let trustline of trustlines){
		let { currency, issuer } = trustline
		let humanCurrency = currencyHexToUTF8(currency)
		let currentStats = await ctx.repo.getRecentStats(trustline)
		/*let currentCandles = await exchanges({
			base: trustline, 
			quote: {currency: 'XRP'},
			format: 'candlesticks',

		})*/
		let currencyMetas = await ctx.repo.getMetas('currency', trustline.id)
		let issuerMetas = await ctx.repo.getMetas('issuer', trustline.issuerId)
		let yesterdayStats
		let trustlinesCount
		let meta = {}
		let stats = {}


		meta.currency = sortMetas(
			nestDotNotated(mapMultiKey(currencyMetas, 'key', true)),
			ctx.config.api.defaultSourcePriority
		)

		meta.issuer = sortMetas(
			nestDotNotated(mapMultiKey(issuerMetas, 'key', true)),
			ctx.config.api.defaultSourcePriority
		)

		if(currentStats){
			stats.trustlines = currentStats.accounts
			stats.supply = currentStats.supply
			stats.liquiditiy = Decimal.sum(currentStats.buy, currentStats.sell)

			yesterdayStats = await ctx.repo.getRecentStats(trustline, currentStats.date - 60*60*24)

			if(yesterdayStats){
				stats.trustlines_change = Math.round((currentStats.accounts / yesterdayStats.accounts - 1) * 10000) / 100
			}
		}

		dataset.push({
			currency: humanCurrency, 
			issuer,
			meta,
			stats,
		})
	}

	dataset.sort((a, b) => b.stats.trustlines - a.stats.trustlines)

	return {dataset}
}

export async function exchanges(ctx){
	let { base, quote, format, interval } = ctx.parameters

	let baseTrustline = base.currency !== 'XRP' 
		? (await ctx.repo.getTrustline(base)).id
		: 0
	let quoteTrustline = quote.currency !== 'XRP' 
		? (await ctx.repo.getTrustline(quote)).id
		: 0

	let mixed = await ctx.repo.getExchanges(baseTrustline, quoteTrustline)
	let exchanges = mixed.map(exchange => {
		if(exchange.from === baseTrustline){
			return {
				date: exchange.date,
				price: new Decimal(exchange.price),
				volume: new Decimal(exchange.volume),
				maker: exchange.maker
			}
		}else{
			return {
				date: exchange.date,
				price: Decimal.div('1', exchange.price),
				volume: Decimal.mul(exchange.volume, exchange.price),
				maker: exchange.maker
			}
		}
	})
	let invalidate = async () => {
		let {min, max} = await ctx.repo.getExchangesCoverage(baseTrustline, quoteTrustline)

		return exchanges[0].date !== min || exchanges[exchanges.length-1].date !== max
	}



	if(format === 'candlesticks'){
		let candles = []
		let candle = null
		let pop = () => {
			candle.u = candle.traders.size
			delete candle.traders
			candles.push(candle)
			candle = null
		}

		for(let exchange of exchanges){
			let t = Math.floor(exchange.date / interval) * interval
			let price = exchange.price
			let volume = exchange.volume

			if(candle && candle.t !== t)
				pop()

			if(!candle){
				candle = {
					t,
					o: price,
					h: price,
					l: price,
					c: price,
					v: volume,
					n: 1,
					traders: new Set([exchange.maker])
				}
			}else{
				candle.h = Decimal.max(candle.h, price)
				candle.l = Decimal.min(candle.l, price)
				candle.c = price
				candle.v = candle.v.plus(volume)
				candle.n += 1
				candle.traders.add(exchange.maker)
			}
		}

		if(candle)
			pop()

		return {dataset: candles}
	}

	return {dataset: exchanges, invalidate}
}



function sortMetas(metas, sourcePriority){
	for(let [key, values] of Object.entries(metas)){
		if(Array.isArray(values)){
			keySort(values, meta => {
				let priority = sourcePriority.indexOf(meta.source)

				return priority >= 0 ? priority : 9999
			})
		}else if(typeof values === 'object'){
			Object.values(values).forEach(metas => sortMetas(metas, sourcePriority))
		}
	}

	return metas
}


/*



	let baseExchanges = [{date: 0, price: 1, volume: 0}]
	let quoteExchanges = [{date: 0, price: 1, volume: 0}]

	if(this.base.currency !== 'XRP'){
		baseExchanges = await this.repo.getExchanges(this.base, {start, end})
		baseExchanges = baseExchanges.filter(exchange => exchange.volume >= 1)

		if(baseExchanges.length === 0){
			let head = await this.repo.getHeadExchange(this.base)

			if(!head)
				return []

			baseExchanges.push(head)
		}

	}

	if(this.quote.currency !== 'XRP'){
		quoteExchanges = await this.repo.getExchanges(this.quote, {start, end})
		quoteExchanges = quoteExchanges.filter(exchange => exchange.volume >= 1)

		if(quoteExchanges.length === 0){
			let head = await this.repo.getHeadExchange(this.quote)

			if(!head)
				return []

			quoteExchanges.push(head)
		}
	}

	let uniqueDates = new Set([
		...baseExchanges.map(exchange => exchange.date),
		...quoteExchanges.map(exchange => exchange.date),
	])
	let timeline = Array.from(uniqueDates)
		.sort((a, b) => a - b)



	let candles = []
	let candle = null
	let baseIndex = 0
	let quoteIndex = 0
	let pop = () => {
		candle.u = candle.traders.size
		delete candle.traders
		candles.push(candle)
		candle = null
	}

	for(let i=0; i<timeline.length; i++){
		let date = timeline[i]

		if(baseExchanges[baseIndex].date > date)
			continue

		if(quoteExchanges[quoteIndex].date > date)
			continue

		while(baseIndex < baseExchanges.length-1 && baseExchanges[baseIndex+1].date <= date){
			baseIndex++
		}

		while(quoteIndex < quoteExchanges.length-1 && quoteExchanges[quoteIndex+1].date <= date){
			quoteIndex++
		}


		let baseExchange = baseExchanges[baseIndex]
		let quoteExchange = quoteExchanges[quoteIndex]
		let t = Math.floor(date / interval) * interval
		let price = baseExchange.price / quoteExchange.price
		let volume = baseExchange.volume * quoteExchange.price + quoteExchange.volume

		if(candle && candle.t !== t)
			pop()

		if(!candle){
			candle = {
				t,
				o: price,
				h: price,
				l: price,
				c: price,
				v: volume,
				n: 1,
				traders: new Set([baseExchange.maker, baseExchange.taker])
			}
		}else{
			candle.h = Math.max(candle.h, price)
			candle.l = Math.min(candle.l, price)
			candle.c = price
			candle.v += volume
			candle.n += 1
			candle.traders.add(baseExchange.maker)
			candle.traders.add(baseExchange.taker)
		}
	}

	if(candle)
		pop()

	return candles*/