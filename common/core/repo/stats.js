export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Stats" (
			"id"		INTEGER NOT NULL UNIQUE,
			"trustline"	INTEGER NOT NULL,
			"ledger"	INTEGER NOT NULL,
			"count"		INTEGER NOT NULL,
			"supply"	TEXT NOT NULL,
			"bid"		TEXT NOT NULL,
			"ask"		TEXT NOT NULL,
			PRIMARY KEY ("id" AUTOINCREMENT),
			UNIQUE ("ledger", "trustline")
		);

		CREATE INDEX IF NOT EXISTS 
		"StatsTrustline" ON "Stats" 
		("trustline");`
	)
}


export function insert({ledger, trustline, replaceAfter, ...stats}){
	let trustlineId = this.trustlines.id(trustline)

	if(replaceAfter){
		this.run(
			`DELETE FROM Stats
			WHERE trustline = ?
			AND ledger > ?`,
			trustlineId,
			replaceAfter
		)
	}

	return this.insert({
		table: 'Stats',
		data: {
			ledger,
			trustline: trustlineId,
			...stats
		},
		duplicate: 'update'
	})
}


export async function all(trustline){
	trustline = await this.trustlines.get(trustline)

	return await this.all(
		`SELECT *
		FROM Stats
		WHERE trustline = ?
		ORDER BY date ASC`,
		trustline.id
	)
}


export async function getRecent(trustline, t){
	if(t === undefined){
		return await this.get(
			`SELECT *
			FROM Stats
			WHERE trustline = ?
			ORDER BY date DESC`,
			trustline.id
		)
	}else{
		return await this.get(
			`SELECT *
			FROM Stats
			WHERE trustline = ?
			AND date >= ?
			ORDER BY date ASC`,
			trustline.id,
			t
		)
	}
	
}