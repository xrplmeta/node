import Decimal from 'decimal.js'
import codec from 'ripple-address-codec'
import { serialize, deserialize } from '../decimal.js'


export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Exchanges" (
			"id"		INTEGER NOT NULL UNIQUE,
			"hash"		BLOB NOT NULL,
			"maker"		BLOB NOT NULL,
			"taker"		BLOB NOT NULL,
			"sequence"	INTEGER NOT NULL,
			"ledger"	INTEGER NOT NULL,
			"base"		INTEGER,
			"quote"		INTEGER,
			"price"		BLOB NOT NULL,
			"volume"	BLOB NOT NULL,
			PRIMARY KEY ("id")
			UNIQUE ("hash", "taker", "sequence")
		);

		CREATE INDEX IF NOT EXISTS 
		"ExchangesBase" ON "Exchanges" 
		("base");

		CREATE INDEX IF NOT EXISTS 
		"ExchangesQuote" ON "Exchanges" 
		("quote");`
	)
}

export function insert(exchanges){
	this.insert({
		table: 'Exchanges',
		data: exchanges.map(exchange => {
			let hash = Buffer.from(exchange.hash, 'hex')
			let maker = codec.decodeAccountID(exchange.maker)
			let taker = codec.decodeAccountID(exchange.taker)
			let base = this.tokens.id(exchange.takerGot)
			let quote = this.tokens.id(exchange.takerPaid)
			let price = serialize(Decimal.div(exchange.takerPaid.value, exchange.takerGot.value))
			let volume = serialize(new Decimal(exchange.takerPaid.value))

			return {
				hash: hash.slice(0, 4),
				maker: maker.slice(0, 4),
				taker: taker.slice(0, 4),
				sequence: exchange.sequence,
				ledger: exchange.ledger,
				base,
				quote,
				price,
				volume
			}
		}),
		duplicate: 'ignore'
	})
}

export function* iter({base, quote, from, to, recent} = {}){
	let sql = `
		SELECT Exchanges.id, ledger, base, quote, price, volume, date 
		FROM Exchanges
		INNER JOIN Ledgers ON (Ledgers."index" = Exchanges.ledger)
	`

	if(base || quote){
		sql += `WHERE "base" IS @base AND "quote" IS @quote`
	}else if(from || to){
		sql += `WHERE id >= @from AND id <= @to`
	}else if(recent){
		sql += `ORDER BY date DESC LIMIT @recent`
	}

	let iter = this.iterate(
		sql, 
		{base, quote, from, to, recent}
	)

	for(let exchange of iter){
		yield decode(exchange)
	}
}

export function decode(exchange){
	return {
		...exchange,
		price: deserialize(exchange.price),
		volume: deserialize(exchange.volume)
	}
}

export function align(exchange, base, quote){
	if(exchange.base === base){
		return {
			id: exchange.id,
			ledger: exchange.ledger,
			date: exchange.date,
			price: exchange.price,
			volume: Decimal.mul(exchange.volume, exchange.price)
		}
	}else if(exchange.base === quote){
		return {
			id: exchange.id,
			ledger: exchange.ledger,
			date: exchange.date,
			price: Decimal.div('1', exchange.price),
			volume: exchange.volume
		}
	}else{
		throw 'unexpected base/quote pair'
	}
}

export function invert(exchanges){
	return {
		id: exchange.id,
		ledger: exchange.ledger,
		date: exchange.date,
		price: Decimal.div('1', exchange.price),
		volume: Decimal.mul(exchange.volume, exchange.price)
	}
}

export function pairs(unique){
	let pairs = this.all(`SELECT DISTINCT base, quote FROM Exchanges`)

	return unique
		? pairs.filter(({base, quote}, i) => 
			i > pairs.findIndex(pair => true
				&& pair.base === quote 
				&& pair.quote === base
			)
		)
		: pairs
}

export function count(){
	return this.getv(`SELECT COUNT(1) FROM Exchanges`)
}