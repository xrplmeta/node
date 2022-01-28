export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Updates" (
			"id"		INTEGER NOT NULL UNIQUE,
			"date"		INTEGER NOT NULL,
			"type"		TEXT NOT NULL,
			"platform"	TEXT NOT NULL,
			"uid"		TEXT NOT NULL UNIQUE,
			"subject"	INTEGER NOT NULL,
			"data"		TEXT NOT NULL,
			PRIMARY KEY("id" AUTOINCREMENT)
		);`
	)
}

export function all(entity){
	let { type, subject } = deriveTypeSubject.call(this, entity)

	if(!subject)
		return []

	return this.all(
		`SELECT *
		FROM Updates
		WHERE type = ? AND subject = ?`,
		type, subject
	)
}


export function insert({platform, account, token, updates}){
	let rows = []
	let type
	let subject

	if(account){
		type = 'A'
		subject = this.accounts.id(account)
	}else if(token){
		type = 'T'
		subject = this.tokens.id(token)
	}else{
		throw 'unspecified subject'
	}

	for(let update of updates){
		rows.push({
			platform,
			type: type,
			subject,
			uid: update.uid,
			date: update.date,
			data: JSON.stringify(update.data)
		})
	}

	this.insert({
		table: 'Updates',
		data: rows,
		duplicate: 'ignore'
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