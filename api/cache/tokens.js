export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Tokens" (
			"id"			INTEGER NOT NULL UNIQUE,
			"currency"		TEXT NOT NULL,
			"issuer"		TEXT NOT NULL,
			"stats"			TEXT NOT NULL,
			"meta"			TEXT NOT NULL,
			"updates"		TEXT NOT NULL,
			"trustlines"	INTEGER NOT NULL,
			"trustlines24h"	INTEGER,
			"trustlines7d"	INTEGER,
			"marketcap"		REAL NOT NULL,
			"volume24h"		REAL NOT NULL,
			"volume7d"		REAL NOT NULL,
			"price"			REAL,
			"price24h"		REAL,
			"price7d"		REAL
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
		"TokensVolume24H" ON "Tokens" 
		("volume24h");

		CREATE INDEX IF NOT EXISTS 
		"TokensVolume7D" ON "Tokens" 
		("volume7d");

		CREATE INDEX IF NOT EXISTS 
		"TokensPrice" ON "Tokens" 
		("price");

		CREATE INDEX IF NOT EXISTS 
		"TokensPrice24H" ON "Tokens" 
		("price24h");

		CREATE INDEX IF NOT EXISTS 
		"TokensPrice7D" ON "Tokens" 
		("price7d");`
	)
}

export function all({limit, offset, sort, minTrustlines}){
	let rows  = this.all(
		`SELECT id, currency, issuer, meta, stats, updates FROM Tokens
		WHERE trustlines >= ?
		ORDER BY volume7d DESC
		LIMIT ?, ?`,
		minTrustlines || 0,
		offset || 0,
		limit || 999999999
	)

	return rows.map(row => decode(row))
}


export function get({currency, issuer}){
	return decode(this.get(
		`SELECT id, currency, issuer, meta, stats, updates FROM Tokens
		WHERE currency = ? AND issuer = ?`,
		currency,
		issuer
	))
}

export function count(){
	return this.getv(`SELECT COUNT(1) FROM Tokens`)
}

export function insert({id, currency, issuer, meta, stats, updates}){
	this.insert({
		table: 'Tokens',
		data: {
			id,
			currency,
			issuer,
			meta: JSON.stringify(meta),
			stats: JSON.stringify(stats),
			updates: JSON.stringify(updates),
			price: stats.price,
			price24h: stats.price_change?.day,
			price7d: stats.price_change?.week,
			trustlines: stats.trustlines,
			trustlines24h: stats.trustlines_change?.day,
			trustlines7d: stats.trustlines_change?.week,
			marketcap: parseFloat(stats.marketcap),
			volume24h: parseFloat(stats.volume?.day),
			volume7d: parseFloat(stats.volume?.week),
		},
		duplicate: 'update'
	})
}

function decode(row){
	if(!row)
		return null

	let { meta, stats, updates, ...token } = row

	return {
		...token,
		meta: JSON.parse(meta),
		stats: JSON.parse(stats),
		updates: JSON.parse(updates),
	}
}