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
		CREATE UNIQUE INDEX IF NOT EXISTS "Exchanges-T" ON "Exchanges" ("tx");
		CREATE INDEX IF NOT EXISTS "Exchanges-B+Q" ON "Exchanges" ("base","quote");`
	)
}


export async function insert(exchanges){
	await this.insert(
		'Exchanges',
		exchanges.map(exchange => {
			let tx = Buffer.from(exchange.tx, 'hex')
			let base = this.trustlines.require(exchange.base)
			let quote = this.trustlines.require(exchange.quote)

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
		{
			duplicate: {
				keys: ['tx'], 
				ignore: true
			}
		}
	)
}


export async function all(base, quote, after){
	let baseId = this.trustlines.require(base)
	let quoteId = this.trustlines.require(quote)
	
	let rows = await this.all(
		`SELECT *
		FROM Exchanges 
		WHERE 
		(
			(\`base\` = @base AND \`quote\` = @quote)
			OR
			(\`base\` = @quote AND \`quote\` = @base)
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