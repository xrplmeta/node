export function init(){
	if(!this.config.ledger?.topPercenters)
		return

	let percents = this.config.ledger.topPercenters
		.map(percent => `"percent${percent.toString().replace('.', '')}"	REAL`)

	this.exec(
		`CREATE TABLE IF NOT EXISTS "Stats" (
			"id"		INTEGER NOT NULL UNIQUE,
			"token"	INTEGER NOT NULL,
			"ledger"	INTEGER NOT NULL,
			"count"		INTEGER NOT NULL,
			"supply"	TEXT NOT NULL,
			"bid"		TEXT NOT NULL,
			"ask"		TEXT NOT NULL,
			${percents.join(', ')},
			PRIMARY KEY ("id" AUTOINCREMENT),
			UNIQUE ("ledger", "token")
		);

		CREATE INDEX IF NOT EXISTS 
		"StatsToken" ON "Stats" 
		("token");`
	)
}


export function insert({ledger, token, replaceAfter, ...stats}){
	let tokenId = this.tokens.id(token)

	if(replaceAfter){
		this.run(
			`DELETE FROM Stats
			WHERE token = ?
			AND ledger > ?`,
			tokenId,
			replaceAfter
		)
	}

	return this.insert({
		table: 'Stats',
		data: {
			ledger,
			token: tokenId,
			...stats
		},
		duplicate: 'update'
	})
}


export function all(token){
	let tokenId = this.tokens.id(token)

	return this.all(
		`SELECT Stats.*, Ledgers.date
		FROM Stats
		INNER JOIN Ledgers ON ("index" = Stats.ledger)
		WHERE token = ?
		ORDER BY ledger ASC`,
		tokenId
	)
}


export function get(token, ledger){
	if(ledger === undefined){
		return this.get(
			`SELECT *, Ledgers.date
			FROM Stats
			INNER JOIN Ledgers ON ("index" = Stats.ledger)
			WHERE token = ?
			ORDER BY ledger DESC`,
			token.id
		)
	}else{
		return this.get(
			`SELECT *, Ledgers.date
			FROM Stats
			INNER JOIN Ledgers ON ("index" = Stats.ledger)
			WHERE token = ?
			AND ledger >= ?
			ORDER BY ledger ASC`,
			token.id,
			ledger
		)
	}
	
}