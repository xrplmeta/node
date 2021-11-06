import Decimal from '../../../common/decimal.js'



export async function insert(exchanges){
	for(let exchange of exchanges){
		let tx = Buffer.from(exchange.tx, 'hex')
		let from = await this.trustlines.idFromCurrency(exchange.from)
		let to = await this.trustlines.idFromCurrency(exchange.to)


		await this.db.insert(
			'Exchanges',
			{
				tx,
				date: exchange.date,
				from,
				to,
				price: exchange.price,
				volume: exchange.volume,
				maker: exchange.maker.slice(1, 6)
			},
			{
				duplicate: {
					keys: ['tx'], 
					ignore: true
				}
			}
		)
	}
}


export async function get(base, quote, after){
	let baseId = typeof base === 'number' ? base : await this.trustlines.idFromCurrency(base)
	let quoteId = typeof quote === 'number' ? quote : await this.trustlines.idFromCurrency(quote)

	let rows = await this.db.all(
		`SELECT *
		FROM Exchanges 
		WHERE 
		(
			(\`from\` = @base AND \`to\` = @quote)
			OR
			(\`from\` = @quote AND \`to\` = @base)
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
		if(exchange.from === baseId){
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