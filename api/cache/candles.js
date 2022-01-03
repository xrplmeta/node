import { unixNow } from '@xrplmeta/utils'
import Decimal from 'decimal.js'


export function all(series, start, end){
	let table = deriveTable(series)
	
	if(!doesTableExist.call(this, table))
		return []

	return this.all(
		`SELECT t, o, h, l, c, v, n FROM ${table}
		WHERE t >= ? AND t <= ?
		ORDER BY t ASC`,
		start || 0,
		end || unixNow()
	)
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
	let interval = series.interval
	let t = Math.floor(exchange.date / interval) * interval

	ensureTable.call(this, table)
	
	let candle = this.get(`SELECT * FROM ${table} WHERE t = ?`, t)
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
	}

	this.insert({
		table,
		data: {
			...candle,
			o: candle.o.toString(),
			h: candle.h.toString(),
			l: candle.l.toString(),
			c: candle.c.toString(),
			v: candle.v.toString(),
		},
		duplicate: 'update'
	})
}

function doesTableExist(table){
	return !!this.getv(
		`SELECT COUNT(1) 
		FROM sqlite_master 
		WHERE type='table' 
		AND name = ?`,
		table
	)
}

function ensureTable(table){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "${table}" (
			"id"		INTEGER NOT NULL UNIQUE,
			"head"		INTEGER NOT NULL,
			"tail"		INTEGER NOT NULL,
			"t"			INTEGER NOT NULL UNIQUE,
			"o"			TEXT NOT NULL,
			"h"			TEXT NOT NULL,
			"l"			TEXT NOT NULL,
			"c"			TEXT NOT NULL,
			"v"			TEXT NOT NULL,
			"n"			INTEGER NOT NULL,
			PRIMARY KEY ("id" AUTOINCREMENT)
		);`
	)
}

function deriveTable({base, quote, interval}){
	return `CandlesB${base || 'X'}Q${quote || 'X'}I${interval}`
}