import log from '../log.js'

export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Tokens" (
			"id"			INTEGER NOT NULL UNIQUE,
			"currency"		TEXT NOT NULL,
			"issuer"		INTEGER NOT NULL,
			"inception"		INTEGER,
			PRIMARY KEY("id" AUTOINCREMENT),
			UNIQUE ("issuer", "currency")
		);
		
		CREATE INDEX IF NOT EXISTS 
		"TokenIssuer" ON "Tokens" 
		("issuer");`
	)
}

export function id(token, create=true){
	if(!token)
		return

	if(typeof token === 'number')
		return token

	if(token.id)
		return token.id

	if(!token.issuer)
		return null

	return this.tokens.get(token)?.id 
		|| (create ? this.tokens.insert(token).id : null)
}


export function get(by){
	if(by.id){
		return this.get(
			`SELECT * FROM Tokens
			WHERE id = ?`,
			by.id,
		) 
	}else if(by.currency){
		let issuerId = this.accounts.id(by.issuer, false)

		if(!issuerId)
			return null

		return this.get(
			`SELECT * FROM Tokens
			WHERE issuer = ? AND currency = ?`,
			issuerId,
			by.currency, 
		)
	}
}


export function all(by = {}){
	if(by.issuer){
		return this.all(
			`SELECT * FROM Tokens
			WHERE issuer = ?`,
			by.issuer, 
		)
	}else{
		return this.all(
			`SELECT *
			FROM Tokens`, 
		)
	}
}


export function insert({ currency, issuer }){
	if(typeof issuer !== 'number')
		issuer = this.accounts.id(issuer)


	return this.insert({
		table: 'Tokens',
		data: {
			currency,
			issuer
		},
		duplicate: 'ignore',
		returnRow: true
	})
}


export function count(){
	return this.getv(`SELECT COUNT(1) FROM Tokens`)
}