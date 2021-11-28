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
			PRIMARY KEY ("id" AUTOINCREMENT)
		);

		CREATE INDEX IF NOT EXISTS 
		"statsTrustline" ON "Stats" 
		("trustline");

		CREATE INDEX IF NOT EXISTS 
		"statsLedger" ON "Stats" 
		("ledger");`
	)
}


export function insert({ledger, trustline, ...stats}){
	let trustlineId = this.trustlines.require(trustline)

	return this.insert(
		'Stats',
		{
			ledger,
			trustline: trustlineId,
			...stats
		},
		{
			keys: ['ledger', 'trustline'],
			update: true
		}
	)
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