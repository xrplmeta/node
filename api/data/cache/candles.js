import { keySort, mapMultiKey, nestDotNotated } from '@xrplmeta/common/lib/data.js'
import { createURI as createPairURI } from '@xrplmeta/common/lib/pair.js'
import { wait } from '@xrplmeta/common/lib/time.js'
import Decimal from '@xrplmeta/common/lib/decimal.js'
import { log } from '@xrplmeta/common/lib/log.js'

const candlestickIntervals = {
	'5m': 60 * 5,
	'15m': 60 * 15,
	'1h': 60 * 60,
	'4h': 60 * 60 * 4,
	'1d': 60 * 60 * 24,
}


export function allocate(series, exchanges){
	let table = deriveTable(series)
	let interval = series.interval
	let candles = []
	let candle = null
	let lastCandle = null

	ensureTable.call(this, table)

	for(let exchange of exchanges){
		let t = Math.floor(exchange.date / interval) * interval
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
		table,
		data: candles.map(candle => ({
			...candle,
			o: candle.o.toString(),
			h: candle.h.toString(),
			l: candle.l.toString(),
			c: candle.c.toString(),
			v: candle.v.toString()
		}))
	})
}



export function integrate(series, exchange){
	let table = deriveTable(series)
	let t = Math.floor(exchange.date / interval) * interval
	let candle = this.get(`SELECT * FROM Candles FROM ? WHERE t = ?`, table, t)

	
}


function ensureTable(table){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "${table}" (
			"id"		INTEGER NOT NULL UNIQUE,
			"head"		INTEGER NOT NULL,
			"tail"		INTEGER NOT NULL,
			"t"			INTEGER NOT NULL,
			"o"			TEXT NOT NULL,
			"h"			TEXT NOT NULL,
			"l"			TEXT NOT NULL,
			"c"			TEXT NOT NULL,
			"v"			TEXT NOT NULL,
			"n"			INTEGER NOT NULL,
			PRIMARY KEY ("id" AUTOINCREMENT)
		);

		CREATE UNIQUE INDEX IF NOT EXISTS
		"${table}-T" ON "${table}"
		("t");`
	)
}

function deriveTable({base, quote, interval}){
	return `CandlesB${base || 'X'}Q${quote || 'X'}I${interval}`
}