import { wait } from '../../lib/time.js'

export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Metas" (
			"id"		INTEGER NOT NULL UNIQUE,
			"type"		TEXT NOT NULL,
			"subject"	INTEGER NOT NULL,
			"key"		TEXT NOT NULL,
			"value"		TEXT,
			"source"	TEXT NOT NULL,
			PRIMARY KEY("id" AUTOINCREMENT)
		);
		CREATE INDEX IF NOT EXISTS "Metas-T+S" ON "Metas" ("type","subject");`
	)
}

export async function all(type, subject){
	return await this.all(
		`SELECT key, value, source
		FROM Metas
		WHERE type = ? AND subject = ? AND value NOT NULL`,
		type, subject
	)
}

export async function get(type, subject, key, source){
	let metas = await this.all(
		`SELECT value, source
		FROM Metas
		WHERE type = ? AND subject = ? AND key = ?`,
		type, subject, key
	)

	if(metas.length === 0)
		return undefined

	if(source)
		return metas.find(meta => meta.source === source)

	return metas[0].value
}

export async function insert(metas){
	let rows = []

	for(let meta of metas){
		if(!meta.meta)
			continue

		if(typeof meta.subject !== 'number'){
			switch(meta.type){
				case 'issuer':
					meta.subject = this.issuers.get({address: meta.subject}, true).id
					break
				case 'trustline':
					meta.subject = this.trustlines.get(meta.subject, true).id
					break
			}
		}

		for(let [key, value] of Object.entries(meta.meta)){
			rows.push({
				type: meta.type,
				subject: meta.subject,
				source: meta.source,
				key,
				value,
			})
		}
	}

	await this.insert(
		'Metas',
		rows,
		{
			duplicate: {
				keys: ['type', 'subject', 'key', 'source'],
				replace: true
			}
		}
	)
}