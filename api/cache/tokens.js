export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Tokens" (
			"id"			INTEGER NOT NULL UNIQUE,
			"currency"		TEXT NOT NULL,
			"issuer"		TEXT NOT NULL,
			"full"			TEXT NOT NULL,
			"condensed"		TEXT NOT NULL,
			"trustlines"	INTEGER NOT NULL,
			"marketcap"		REAL NOT NULL,
			"volume"		REAL NOT NULL
		);
		
		CREATE INDEX IF NOT EXISTS 
		"TokensCurrency" ON "Tokens" 
		("currency");

		CREATE INDEX IF NOT EXISTS 
		"TokensIssuer" ON "Tokens" 
		("issuer");

		CREATE INDEX IF NOT EXISTS 
		"TokensTrustlines" ON "Tokens" 
		("trustlines");

		CREATE INDEX IF NOT EXISTS 
		"TokensMarketcap" ON "Tokens" 
		("marketcap");

		CREATE INDEX IF NOT EXISTS 
		"TokensVolume" ON "Tokens" 
		("volume");`
	)
}

export function all({limit, offset, minTrustlines, full}){
	let rows  = this.all(
		`SELECT id, currency, issuer, ${full ? 'full' : 'condensed'} as meta FROM Tokens
		WHERE trustlines >= ?
		ORDER BY volume DESC
		LIMIT ?, ?`,
		minTrustlines || 0,
		offset || 0,
		limit || 999999999
	)

	return rows.map(row => decode(row))
}


export function get({currency, issuer}, full){
	return decode(this.get(
		`SELECT id, currency, issuer, ${full ? 'full' : 'condensed'} as meta FROM Tokens
		WHERE currency = ? AND issuer = ?`,
		currency,
		issuer
	))
}

export function count(){
	return this.getv(`SELECT COUNT(1) FROM Tokens`)
}

export function insert({id, currency, issuer, full, condensed}){
	this.insert({
		table: 'Tokens',
		data: {
			id,
			currency,
			issuer,
			full: JSON.stringify(full),
			condensed: JSON.stringify(condensed),
			trustlines: full.stats.trustlines,
			marketcap: parseFloat(full.stats.marketcap),
			volume: parseFloat(full.stats.volume),
		},
		duplicate: 'update'
	})
}

function decode(row){
	if(!row)
		return null

	let { meta, ...token } = row

	return {
		...token,
		...JSON.parse(meta)
	}
}