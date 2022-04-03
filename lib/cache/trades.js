import { unixNow } from '@xrplworks/time'


export function all(pair, start, end){
	let table = deriveTable(pair)
	
	if(!doesTableExist.call(this, table))
		return []

	return this.all(
		`SELECT * FROM ${table}
		WHERE date >= ? AND date <= ?
		ORDER BY date ASC`,
		start || 0,
		end || unixNow()
	)
}

export function allocate(pair, exchanges){
	let table = deriveTable(pair)

	ensureTable.call(this, table)

	this.insert({
		table,
		data: exchanges
			.slice(-this.config.tokens.exchanges.limit)
			.map(exchange => format(exchange))
	})
}


export function integrate(pair, exchange){
	let table = deriveTable(pair)

	ensureTable.call(this, table)

	let recent = this.getv(`SELECT MAX(ledger) FROM ${table}`)
	let count = this.getv(`SELECT COUNT(1) FROM ${table}`)

	if(exchange.ledger < recent)
		return
	
	this.insert({
		table,
		data: format(exchange),
		duplicate: 'update'
	})

	if(count+1 > this.config.tokens.exchanges.limit)
		this.exec(`DELETE FROM ${table} ORDER BY ledger ASC LIMIT 1`)
}


function format(exchange){
	return {
		id: exchange.id,
		ledger: exchange.ledger,
		date: exchange.date,
		price: exchange.price.toString(),
		volume: exchange.volume.toString()
	}
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
	if(doesTableExist.call(this, table))
		return

	this.exec(
		`CREATE TABLE "${table}" (
			"id"		INTEGER NOT NULL UNIQUE,
			"ledger"	INTEGER NOT NULL,
			"date"		INTEGER NOT NULL,
			"price"		TEXT NOT NULL,
			"volume"	TEXT NOT NULL
		);

		CREATE INDEX IF NOT EXISTS
		"${table}T" ON "${table}"
		("date");`
	)
}

function deriveTable({base, quote}){
	return `TradesB${base || 'X'}Q${quote || 'X'}`
}