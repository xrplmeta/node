import Decimal from '../../lib/decimal.js'
import { serialize, deserialize } from '../../lib/decimal.io.js'
import codec from 'ripple-address-codec'


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
			let base = this.trustlines.id(exchange.base)
			let quote = this.trustlines.id(exchange.quote)
			let price = serialize(new Decimal(exchange.price))
			let volume = serialize(new Decimal(exchange.volume))

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


export function all(base, quote){
	let baseId = base ? this.trustlines.id(base) : null
	let quoteId = quote ? this.trustlines.id(quote) : null
	
	let rows = this.all(
		`SELECT Exchanges.id, ledger, base, quote, price, volume, date
		FROM Exchanges 
		INNER JOIN Ledgers ON (Ledgers."index" = Exchanges.ledger)
		WHERE 
		(
			(\`base\` IS @base AND \`quote\` IS @quote)
			OR
			(\`base\` IS @quote AND \`quote\` IS @base)
		)
		ORDER BY date ASC`, 
		{
			base: baseId, 
			quote: quoteId
		}
	)

	return rows.map(exchange => {
		let price = deserialize(exchange.price)
		let volume = deserialize(exchange.volume)

		if(exchange.base === baseId){
			return {
				id: exchange.id,
				ledger: exchange.ledger,
				date: exchange.date,
				price: price,
				volume: Decimal.mul(volume, price)
			}
		}else{
			return {
				id: exchange.id,
				ledger: exchange.ledger,
				date: exchange.date,
				price: Decimal.div('1', price),
				volume: volume
			}
		}
	})
}

export function invert(exchanges){
	return exchanges.map(exchange => ({
		id: exchange.id,
		ledger: exchange.ledger,
		date: exchange.date,
		price: Decimal.div('1', exchange.price),
		volume: Decimal.mul(exchange.volume, exchange.price)
	}))
}


export function count(){
	return this.getv(`SELECT COUNT(1) FROM Exchanges`)
}