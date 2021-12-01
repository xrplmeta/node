export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Balances" (
			"account"	INTEGER NOT NULL,
			"trustline"	INTEGER,
			"balance"	TEXT NOT NULL,
			UNIQUE ("account", "trustline")
		);

		CREATE INDEX IF NOT EXISTS 
		"BalancesTrustline" ON "Balances" 
		("trustline");`
	)
}

export function get({account, trustline}){
	return this.get(
		`SELECT * FROM Balances
		WHERE account = ?
		AND trustline IS ?`,
		this.accounts.require(account),
		trustline
			? this.trustlines.require(trustline)
			: null,
	)
}

export function all(by){
	if(by.trustline){
		return this.all(
			`SELECT * FROM Balances
			WHERE trustline = ?`,
			this.trustlines.require(by.trustline)
		)
	}
}

export function insert({account, trustline, balance}){
	let accountId = this.accounts.require(account)
	let trustlineId = trustline
		? this.trustlines.require(trustline)
		: null

	return this.insert({
		table: 'Balances',
		data: {
			account: accountId,
			trustline: trustlineId,
			balance
		},
		duplicate: 'update'
	})
}

export function count(){
	return this.getv(`SELECT COUNT(1) FROM Balances`)
}