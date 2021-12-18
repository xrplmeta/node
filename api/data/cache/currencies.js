export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Currencies" (
			"currency"		INTEGER NOT NULL UNIQUE,
			"marketcap"		REAL NOT NULL,
			"volume"		REAL NOT NULL
		);
		
		CREATE INDEX IF NOT EXISTS 
		"CurrenciesMarketcap" ON "Currencies" 
		("marketcap");

		CREATE INDEX IF NOT EXISTS 
		"CurrenciesVolume" ON "Currencies" 
		("volume");`
	)
}


export function all({limit, offset, filter}){
	return this.all(
		`SELECT * FROM Currencies
		${filter ? 'WHERE currency LIKE @filter' : ''}
		ORDER BY volume DESC
		LIMIT @offset, @limit`,
		{
			limit,
			offset,
			filter: filter ? `${filter}%` : null
		}
	)
}

export function count(){
	return this.getv(`SELECT COUNT(1) FROM Currencies`)
}

export function insert(data){
	this.insert({
		table: 'Currencies',
		data: {
			...data,
			marketcap: data.marketcap.toNumber(),
			volume: data.volume.toNumber()
		},
		duplicate: 'update'
	})
}