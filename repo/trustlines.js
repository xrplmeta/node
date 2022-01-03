import { log } from '../../lib/log.js'

export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Trustlines" (
			"id"			INTEGER NOT NULL UNIQUE,
			"currency"		TEXT NOT NULL,
			"issuer"		INTEGER NOT NULL,
			"inception"		INTEGER,
			PRIMARY KEY("id" AUTOINCREMENT),
			UNIQUE ("issuer", "currency")
		);
		
		CREATE INDEX IF NOT EXISTS 
		"TrustlinesIssuer" ON "Trustlines" 
		("issuer");`
	)
}

export function id(trustline, create=true){
	if(typeof trustline === 'number')
		return trustline

	if(trustline.id)
		return trustline.id

	if(!trustline.issuer)
		return null

	return this.trustlines.get(trustline)?.id 
		|| (create ? this.trustlines.insert(trustline).id : null)
}


export function get(by){
	if(by.id){
		return this.get(
			`SELECT * FROM Trustlines
			WHERE id = ?`,
			by.id,
		) 
	}else if(by.currency){
		let issuerId = this.accounts.id(by.issuer, false)

		if(!issuerId)
			return null

		return this.get(
			`SELECT * FROM Trustlines
			WHERE issuer = ? AND currency = ?`,
			issuerId,
			by.currency, 
		)
	}
}


export function all(){
	return this.all(
		`SELECT *
		FROM Trustlines`, 
	)
}


export function insert({...trustline}){
	if(typeof trustline.issuer !== 'number')
		trustline.issuer = this.accounts.id(trustline.issuer)


	return this.insert({
		table: 'Trustlines',
		data: trustline,
		duplicate: 'ignore',
		returnRow: true
	})
}


export function count(){
	return this.getv(`SELECT COUNT(1) FROM Trustlines`)
}