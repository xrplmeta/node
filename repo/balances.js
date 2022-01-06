export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Balances" (
			"account"	INTEGER NOT NULL,
			"token"		INTEGER,
			"balance"	TEXT NOT NULL,
			UNIQUE ("account", "token")
		);

		CREATE INDEX IF NOT EXISTS 
		"BalancesTrustline" ON "Balances" 
		("token");`
	)
}

export function get({account, token}){
	return this.get(
		`SELECT * FROM Balances
		WHERE account = ?
		AND token IS ?`,
		this.accounts.id(account),
		token
			? this.tokens.id(token)
			: null,
	)
}

export function all(by){
	if(by.token){
		return this.all(
			`SELECT * FROM Balances
			WHERE token = ?`,
			this.tokens.id(by.token)
		)
	}
}

export function insert({account, token, balance}){
	let accountId = this.accounts.id(account)
	let tokenId = token
		? this.tokens.id(token)
		: null

	return this.insert({
		table: 'Balances',
		data: {
			account: accountId,
			token: tokenId,
			balance
		},
		duplicate: 'update'
	})
}

export function count(){
	return this.getv(`SELECT COUNT(1) FROM Balances`)
}