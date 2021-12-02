import Decimal from '../../lib/decimal.js'


export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Exchanges" (
			"id"		INTEGER NOT NULL UNIQUE,
			"tx"		BLOB NOT NULL UNIQUE,
			"date"		INTEGER NOT NULL,
			"base"		INTEGER,
			"quote"		INTEGER,
			"price"		REAL NOT NULL,
			"volume"	REAL NOT NULL,
			"maker"		BLOB NOT NULL,
			PRIMARY KEY("id")
		);

		CREATE INDEX IF NOT EXISTS 
		"ExchangesBaseQuote" ON "Exchanges" 
		("base","quote");`
	)
}


export async function insert(exchanges){
	await this.insert({
		table: 'Exchanges',
		data: exchanges.map(exchange => {
			let tx = Buffer.from(exchange.tx, 'hex')
			let base = this.trustlines.id(exchange.base)
			let quote = this.trustlines.id(exchange.quote)

			return {
				tx,
				date: exchange.date,
				base,
				quote,
				price: exchange.price.toString(),
				volume: exchange.volume.toString(),
				maker: exchange.maker.slice(1, 6)
			}
		}),
		duplicate: 'ignore'
	})
}


export async function all(base, quote, after){
	let baseId = this.trustlines.id(base)
	let quoteId = this.trustlines.id(quote)
	
	let rows = await this.all(
		`SELECT *
		FROM Exchanges 
		WHERE 
		(
			(\`base\` IS @base AND \`quote\` IS @quote)
			OR
			(\`base\` IS @quote AND \`quote\` IS @base)
		)
		AND
		id > @after
		ORDER BY date ASC`, 
		{
			base: baseId, 
			quote: quoteId,
			after: after || 0
		}
	)

	return rows.map(exchange => {
		if(exchange.base === baseId){
			return {
				id: exchange.id,
				date: exchange.date,
				price: new Decimal(exchange.price),
				volume: Decimal.mul(exchange.volume, exchange.price),
				maker: exchange.maker
			}
		}else{
			return {
				id: exchange.id,
				date: exchange.date,
				price: Decimal.div('1', exchange.price),
				volume: new Decimal(exchange.volume),
				maker: exchange.maker
			}
		}
	})
}