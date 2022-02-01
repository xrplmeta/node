export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Tokens" (
			"id"				INTEGER NOT NULL UNIQUE,
			"currency"			TEXT NOT NULL,
			"issuer"			TEXT NOT NULL,
			"stats"				TEXT NOT NULL,
			"meta"				TEXT NOT NULL,
			"trusted"			INTEGER NOT NULL,
			"popular"			REAL NOT NULL,
			"marketcap"			REAL NOT NULL,
			"trustlines"		INTEGER NOT NULL,
			"trustlines_day"	INTEGER,
			"trustlines_week"	INTEGER,
			"volume_day"		REAL NOT NULL,
			"volume_week"		REAL NOT NULL,
			"price_day"			REAL,
			"price_week"		REAL
		);
		
		CREATE INDEX IF NOT EXISTS 
		"TokensCurrency" ON "Tokens" 
		("currency");

		CREATE INDEX IF NOT EXISTS 
		"TokensIssuer" ON "Tokens" 
		("issuer");

		CREATE INDEX IF NOT EXISTS 
		"TokensTrusted" ON "Tokens" 
		("trusted");

		CREATE INDEX IF NOT EXISTS 
		"TokensPopular" ON "Tokens" 
		("popular");

		CREATE INDEX IF NOT EXISTS 
		"TokensMarketcap" ON "Tokens" 
		("marketcap");

		CREATE INDEX IF NOT EXISTS 
		"TokensTrustlines" ON "Tokens" 
		("trustlines");

		CREATE INDEX IF NOT EXISTS 
		"TrustlinesDay" ON "Tokens" 
		("trustlines_day");

		CREATE INDEX IF NOT EXISTS 
		"TrustlinesWeek" ON "Tokens" 
		("trustlines_week");

		CREATE INDEX IF NOT EXISTS 
		"TokensVolumeDay" ON "Tokens" 
		("volume_day");

		CREATE INDEX IF NOT EXISTS 
		"TokensVolumeWeek" ON "Tokens" 
		("volume_week");

		CREATE INDEX IF NOT EXISTS 
		"TokensPriceDay" ON "Tokens" 
		("price_day");

		CREATE INDEX IF NOT EXISTS 
		"TokensPriceWeek" ON "Tokens" 
		("price_week");`
	)
}

export function all({limit, offset, sort, trusted, search, minTrustlines}){
	let rows  = this.all(
		`SELECT id, currency, issuer, meta, stats FROM Tokens
		WHERE trustlines >= @minTrustlines
		${trusted ? `AND trusted=1` : ``}
		${search ? `AND currency LIKE @searchAny OR issuer LIKE @searchStarting` : ``}
		ORDER BY ${sort} DESC
		LIMIT @offset, @limit`,
		{
			minTrustlines: minTrustlines || 0,
			offset: offset || 0,
			limit: limit || 999999999,
			searchAny: search ? `%${search}%` : undefined,
			searchStarting: search ? `${search}%` : undefined,
		}
	)

	return rows.map(row => decode(row))
}


export function get({currency, issuer}){
	return decode(this.get(
		`SELECT id, currency, issuer, meta, stats FROM Tokens
		WHERE currency = ? AND issuer = ?`,
		currency,
		issuer
	))
}

export function count(){
	return this.getv(`SELECT COUNT(1) FROM Tokens`)
}

export function insert({id, currency, issuer, meta, stats, trusted, popular}){
	this.insert({
		table: 'Tokens',
		data: {
			id,
			currency,
			issuer,
			trusted: trusted ? 1 : 0,
			popular,
			meta: JSON.stringify(meta),
			stats: JSON.stringify(stats),
			marketcap: parseFloat(stats.marketcap),
			trustlines: stats.trustlines,
			trustlines_day: stats.trustlines_change?.day,
			trustlines_week: stats.trustlines_change?.week,
			volume_day: parseFloat(stats.volume?.day),
			volume_week: parseFloat(stats.volume?.week),
			price_week: stats.price_change?.week,
			price_day: stats.price_change?.day,
		},
		duplicate: 'update'
	})
}

function decode(row){
	if(!row)
		return null

	let { meta, stats, ...token } = row

	return {
		...token,
		meta: JSON.parse(meta),
		stats: JSON.parse(stats)
	}
}