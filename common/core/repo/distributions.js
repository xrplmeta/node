export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Distributions" (
			"id"		INTEGER NOT NULL UNIQUE,
			"ledger"	INTEGER NOT NULL,
			"trustline"	INTEGER NOT NULL,
			"percent"	REAL NOT NULL,
			"share"		REAL NOT NULL,
			PRIMARY KEY("id" AUTOINCREMENT),
			UNIQUE ("ledger", "trustline", "percent")
		);

		CREATE INDEX IF NOT EXISTS 
		"DistributionsTrustline" ON "Distributions" 
		("trustline");`
	)
}


export function insert({ledger, trustline, percenters, replaceAfter}){
	let trustlineId = this.trustlines.id(trustline)

	if(replaceAfter){
		this.run(
			`DELETE FROM Distributions
			WHERE trustline = ?
			AND ledger > ?`,
			trustlineId,
			replaceAfter
		)
	}

	this.insert({
		table: 'Distributions',
		data: percenters.map(data => ({
			ledger,
			trustline: trustlineId,
			...data
		})),
		duplicate: 'update'
	})
}