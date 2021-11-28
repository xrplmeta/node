export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Distributions" (
			"id"		INTEGER NOT NULL UNIQUE,
			"ledger"	INTEGER NOT NULL,
			"trustline"	INTEGER NOT NULL,
			"percent"	REAL NOT NULL,
			"share"		REAL NOT NULL,
			PRIMARY KEY("id" AUTOINCREMENT)
		);

		CREATE INDEX IF NOT EXISTS 
		"distributionsTrustline" ON "Distributions" 
		("trustline");`
	)
}


export function insert({ledger, trustline, percenters, replaceAfter}){
	let trustlineId = this.trustlines.require(trustline)

	if(replaceAfter){
		this.run(
			`DELETE FROM Distributions
			WHERE trustline = ?
			AND ledger > ?`,
			trustlineId,
			replaceAfter
		)
	}

	this.insert(
		'Distributions',
		percenters.map(data => ({
			ledger,
			trustline: trustlineId,
			...data
		})),
		{
			duplicate: {
				keys: ['ledger', 'trustline', 'percent'],
				update: true
			}
		}
	)
}