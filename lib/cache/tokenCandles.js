import Decimal from 'decimal.js'
import { unixNow } from '@xrplworks/time'


export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "TokenCandles" (
			"id"		INTEGER NOT NULL UNIQUE,
			"base"		INTEGER,
			"quote"		INTEGER,
			"timeframe"	INTEGER NOT NULL,
			"head"		INTEGER NOT NULL,
			"tail"		INTEGER NOT NULL,
			"t"			INTEGER NOT NULL,
			"o"			TEXT NOT NULL,
			"h"			TEXT NOT NULL,
			"l"			TEXT NOT NULL,
			"c"			TEXT NOT NULL,
			"v"			TEXT NOT NULL,
			"n"			INTEGER NOT NULL,
			PRIMARY KEY ("id" AUTOINCREMENT),
			UNIQUE ("base", "quote", "timeframe", "t")
		);`
	)
}


export function all(series, start, end){
	return this.all(
		`SELECT t, o, h, l, c, v, n FROM TokenCandles
		WHERE base IS @base
		AND quote IS @quote
		AND timeframe = @timeframe
		AND t >= @start
		AND t <= @end
		ORDER BY t ASC`,
		{
			...series,
			start: Math.floor((start || 0) / series.timeframe) * series.timeframe,
			end: end || unixNow()
		}
	)
}

export function allocate(series, exchanges){
	let candles = []
	let candle = null
	let lastCandle = null

	for(let exchange of exchanges){
		let t = Math.floor(exchange.date / series.timeframe) * series.timeframe
		let price = exchange.price
		let volume = exchange.volume
		
		if(candle && candle.t !== t){
			candles.push(candle)
			lastCandle = candle
			candle = null
		}

		if(!candle){
			candle = {
				t,
				head: exchange.ledger,
				tail: exchange.ledger,
				o: price,
				h: price,
				l: price,
				c: price,
				v: volume,
				n: 1
			}
		}else{
			candle.head = Math.max(candle.head, exchange.ledger)
			candle.tail = Math.min(candle.tail, exchange.ledger)
			candle.h = Decimal.max(candle.h, price)
			candle.l = Decimal.min(candle.l, price)
			candle.c = price
			candle.v = candle.v.plus(volume)
			candle.n += 1
		}
	}

	if(candle)
		candles.push(candle)

	this.insert({
		table: 'TokenCandles',
		data: candles.map(candle => ({
			...candle,
			...series,
			o: candle.o.toString(),
			h: candle.h.toString(),
			l: candle.l.toString(),
			c: candle.c.toString(),
			v: candle.v.toString()
		}))
	})
}



export function integrate(series, exchange){
	let timeframe = series.timeframe
	let t = Math.floor(exchange.date / timeframe) * timeframe
	let candle = this.get(
		`SELECT * FROM TokenCandles 
		WHERE base IS @base
		AND quote IS @quote
		AND timeframe = @timeframe
		AND t = @t`,
		{
			...series,
			t
		}
	)

	let price = exchange.price
	let volume = exchange.volume

	if(candle){
		candle.h = Decimal.max(candle.h, price)
		candle.l = Decimal.min(candle.l, price)
		candle.v = Decimal.sum(candle.v, volume)
		candle.n += 1

		if(exchange.ledger < candle.tail){
			candle.tail = exchange.ledger
			candle.o = price
		}else if(exchange.ledger > candle.head){
			candle.head = exchange.ledger
			candle.c = price
		}
	}else{
		candle = {
			head: exchange.ledger,
			tail: exchange.ledger,
			t,
			o: price,
			h: price,
			l: price,
			c: price,
			v: volume,
			n: 1
		}
	}

	this.insert({
		table: 'TokenCandles',
		data: {
			...candle,
			...series,
			o: candle.o.toString(),
			h: candle.h.toString(),
			l: candle.l.toString(),
			c: candle.c.toString(),
			v: candle.v.toString(),
		},
		duplicate: 'update'
	})
}