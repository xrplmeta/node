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

export function all(entity){
	let { type, subject } = deriveTypeSubject.call(this, entity)

	if(!subject)
		return []

	return this.all(
		`SELECT key, value, source
		FROM Metas
		WHERE type = ? AND subject = ? AND value NOT NULL`,
		type, subject
	)
}

export function get({key, source, ...entity}){
	let { type, subject } = deriveTypeSubject.call(this, entity)

	if(!subject)
		return undefined

	let metas = this.all(
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

export function insert(meta){
	let rows = []
	let type
	let subject

	if(meta.account){
		type = 'A'
		subject = this.accounts.id(meta.account)
	}else if(meta.token){
		type = 'T'
		subject = this.tokens.id(meta.token)
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

	this.insert({
		table: 'Metas',
		data: rows,
		duplicate: 'replace'
	})
}

function deriveTypeSubject(entity){
	let type
	let subject

	if(entity.account){
		type = 'A'
		subject = this.accounts.id(entity.account, false)
	}else if(entity.token){
		type = 'T'
		subject = this.tokens.id(entity.token, false)
	}

	return {type, subject}
}