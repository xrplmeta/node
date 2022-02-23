export function init(){
	if(!this.config.ledger?.topPercenters)
		return

	let percents = this.config.ledger.topPercenters
		.map(percent => `"percent${percent.toString().replace('.', '')}"	REAL`)

	this.exec(
		`CREATE TABLE IF NOT EXISTS "Stats" (
			"id"			INTEGER NOT NULL UNIQUE,
			"token"			INTEGER NOT NULL,
			"ledger"		INTEGER NOT NULL,
			"trustlines"	INTEGER NOT NULL,
			"supply"		TEXT NOT NULL,
			"bid"			TEXT NOT NULL,
			"ask"			TEXT NOT NULL,
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


export function all({ token, from, to }){
	let tokenId = this.tokens.id(token)

	let sql = `
		SELECT Stats.*, Ledgers.date
		FROM Stats
		INNER JOIN Ledgers ON ("index" = Stats.ledger)
	`

	if(token){
		sql += `WHERE token = @token`
	}else if(from || to){
		sql += `WHERE id >= @from AND id <= @to`
	}

	sql += ` ORDER BY LEDGER`

	return this.all(
		sql,
		{
			token: tokenId,
			from,
			to
		}
	)
}


export function get(token, date){
	if(date === undefined){
		return this.get(
			`SELECT Stats.*, Ledgers.date
			FROM Stats
			INNER JOIN Ledgers ON ("index" = Stats.ledger)
			WHERE token = ?
			ORDER BY ledger DESC`,
			token.id
		)
	}else{
		return this.get(
			`SELECT Stats.*, Ledgers.date
			FROM Stats
			INNER JOIN Ledgers ON ("index" = Stats.ledger)
			WHERE token = ?
			AND Ledgers.date >= ?
			ORDER BY ledger ASC`,
			token.id,
			date
		)
	}
	
}