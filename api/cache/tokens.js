export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Tokens" (
			"id"			INTEGER NOT NULL UNIQUE,
			"currency"		TEXT NOT NULL,
			"issuer"		TEXT NOT NULL,
			"full"			TEXT NOT NULL,
			"condensed"		TEXT NOT NULL,
			"accounts"		INTEGER NOT NULL,
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
		"TokensAccounts" ON "Tokens" 
		("accounts");

		CREATE INDEX IF NOT EXISTS 
		"TokensMarketcap" ON "Tokens" 
		("marketcap");

		CREATE INDEX IF NOT EXISTS 
		"TokensVolume" ON "Tokens" 
		("volume");`
	)
}

export function all({currency, minAccounts, limit}, full){
	let rows

	if(currency){
		rows = this.all(
			`SELECT id, currency, issuer, ${full ? 'full' : 'condensed'} as meta FROM Tokens
			WHERE currency = ?
			AND accounts >= ?
			ORDER BY volume DESC
			LIMIT ?`,
			currency,
			minAccounts || 0,
			limit || 999999999
		)
	}

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

export function insert({id, currency, issuer, full, condensed}){
	this.insert({
		table: 'Tokens',
		data: {
			id,
			currency,
			issuer,
			full: JSON.stringify(full),
			condensed: JSON.stringify(condensed),
			accounts: full.stats.tokens,
			marketcap: parseFloat(full.stats.marketcap),
			volume: parseFloat(full.stats.volume),
		},
		duplicate: 'update'
	})
}

function decode(row){
	let { meta, ...token } = row

	return {
		...token,
		...JSON.parse(meta)
	}
}