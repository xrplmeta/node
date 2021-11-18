import { log } from '../../lib/logging.js'
import { keySort, mapMultiKey, nestDotNotated } from '../../../common/data.js'
import { createURI as createPairURI } from '../../../common/pair.js'
import Decimal from '../../../common/decimal.js'

const candlestickIntervals = {
	'5m': 60 * 5,
	'15m': 60 * 15,
	'1h': 60 * 60,
	'4h': 60 * 60 * 4,
	'1d': 60 * 60 * 24,
}



export default class{
	constructor(ctx){
		this.ctx = ctx
		this.data = {}
		this.pairs = {}
		this.log = log.for('server.exchanges', 'green')
	}

	async init(){
		let trustlines = await this.ctx.repo.trustlines.get()
		let i = 0

		for(let trustline of trustlines){
			await this.build(trustline, {currency: 'XRP'})

			this.log.replace(`building cache (${Math.round((i++ / trustlines.length) * 100)}%)`)
		}

		this.log(`built cache           `)

		this.ctx.repo.updates.subscribe(this.handleUpdates.bind(this))
	}

	async get(base, quote, interval){
		let key = this.deriveKey(base, quote, interval)

		if(!this.data[key])
			await this.build(base, quote)

		return this.data[key].candles
	}

	async handleUpdates(updates){
		for(let update of updates){
			if(update.context !== 'exchanges')
				continue

			for(let pair of Object.values(this.pairs)){
				if(pair.base.id === update.subject || pair.quote.id === update.subject){
					await this.build(pair.base, pair.quote)
				}
			}
		}
	}


	async build(base, quote){
		let ctx = this.ctx
		let baseId = typeof base === 'number' ? base : await ctx.repo.trustlines.idFromCurrency(base)
		let quoteId = typeof quote === 'number' ? quote : await ctx.repo.trustlines.idFromCurrency(quote)
		let exchanges = await ctx.repo.exchanges.get(baseId, quoteId)


		this.filterOutliers(exchanges)


		for(let [intervalKey, interval] of Object.entries(candlestickIntervals)){
			let key = this.deriveKey(base, quote, intervalKey)
			let candles = []
			let candle = null
			let lastCandle = null
			let pop = () => {
				candles.push(candle)
				lastCandle = candle
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
						n: 1
					}
				}else{
					candle.h = Decimal.max(candle.h, price)
					candle.l = Decimal.min(candle.l, price)
					candle.c = price
					candle.v = candle.v.plus(volume)
					candle.n += 1
				}
			}

			if(candle)
				pop()


			this.data[key] = {
				base: baseId,
				quote: quoteId,
				interval,
				candles
			}

			this.pairs[`${baseId}/${quoteId}`] = {base, quote}
		}
	}

	filterOutliers(exchanges){
		for(let i=1; i<exchanges.length; i++){
			let current = exchanges[i]
			let prev = exchanges[i-1]


			if(Decimal.div(current.price, prev.price).gt('1.5')){
				let slice = exchanges.slice(Math.max(0, i - 25), i + 25)
				let avg = new Decimal(0)
				let sum = new Decimal(0)

				for(let ex of slice){
					if(ex === current)
						continue

					avg = avg.plus(Decimal.mul(ex.price, ex.volume))
					sum = sum.plus(ex.volume)
				}

				if(Decimal.div(current.price, avg.div(sum)).gt('1.5')){
					exchanges.splice(i, 1)
					i--
				}
			}
		}
	}

	deriveKey(base, quote, interval){
		return `${createPairURI({base, quote})}/${interval}`
	}
}



/*
async handleUpdates(updates){
		for(let update of updates){
			if(update.context !== 'exchanges')
				continue

			for(let entry of Object.values(this.data)){
				if(entry.base === update.subject || entry.quote === update.subject){
					await this.update(entry)
				}
			}
		}
	}

	async update(entry){
		let exchanges = await this.ctx.repo.exchanges.get(entry.base, entry.quote, entry.head?.id)

		console.log('updating', entry)
		console.log('new exchanges', exchanges)

		for(let exchange of exchanges){
			let extendsHead = exchange.date > (entry.tail?.date || 0)
			let t = Math.floor(exchange.date / entry.interval) * entry.interval
			let candle = entry.candles.find(candle => candle.t === t)
			let price = exchange.price
			let volume = exchange.volume

			if(!candle){
				candle = {
					t,
					o: price,
					h: price,
					l: price,
					c: price,
					v: volume,
					n: 1
				}

				if(extendsHead){
					entry.candles.push(candle)
				}else{
					entry.candles.unshift(candle)
				}
			}else{
				if(extendsHead)
					candle.c = price
				else
					candle.o = price

				candle.h = Decimal.max(candle.h, price)
				candle.l = Decimal.min(candle.l, price)
				candle.v = candle.v.plus(volume)
				candle.n += 1
			}

			entry.head = exchange
		}
	}

*/