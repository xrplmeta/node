export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Distributions" (
			"id"		INTEGER NOT NULL UNIQUE,
			"trustline"	INTEGER NOT NULL,
			"date"		INTEGER NOT NULL,
			"percent"	REAL NOT NULL,
			"share"		REAL NOT NULL,
			PRIMARY KEY("id" AUTOINCREMENT)
		);
		CREATE INDEX IF NOT EXISTS "Distributions-T" ON "Distributions" ("trustline");`
	)
}


export async function insert(t, {currency, issuer}, distributions, replaceAfter){
	let trustline = await this.trustlines.get({currency, issuer})

	if(replaceAfter){
		await this.run(
			`DELETE FROM Distributions
			WHERE trustline = ?
			AND date > ?`,
			trustline.id,
			replaceAfter
		)
	}

	await this.insert(
		'Distributions',
		distributions.map(distribution => ({
			trustline: trustline.id,
			date: t,
			percent: distribution.percent,
			share: distribution.share
		})),
		{
			duplicate: {
				keys: ['trustline', 'date', 'percent'],
				update: true
			}
		}
	)
}