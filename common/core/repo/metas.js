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
			PRIMARY KEY("id" AUTOINCREMENT),
			UNIQUE ("type", "subject", "key", "source")
		);`
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

export async function get({key, source, ...entity}){
	let type
	let subject

	// todo: make this not create new entries on lookup with no matches

	if(entity.account){
		type = 'A'
		subject = this.accounts.id(entity.account, false)
	}else if(entity.trustline){
		type = 'T'
		subject = this.trustlines.id(entity.trustline, false)
	}

	if(!subject)
		return undefined

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

	return metas[0]
}

export async function insert(metas){
	let rows = []

	for(let meta of metas){
		let type
		let subject

		if(meta.account){
			type = 'A'
			subject = this.accounts.id(meta.account)
		}else if(meta.trustline){
			type = 'T'
			subject = this.trustlines.id(meta.trustline)
		}else{
			throw 'unspecified subject'
		}

		for(let [key, value] of Object.entries(meta.meta)){
			rows.push({
				type: type,
				subject: subject,
				key,
				value,
				source: meta.source,
			})
		}
	}

	await this.insert({
		table: 'Metas',
		data: rows,
		duplicate: 'replace'
	})
}