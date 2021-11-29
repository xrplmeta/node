export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Balances" (
			"account"	INTEGER NOT NULL,
			"trustline"	INTEGER,
			"balance"	TEXT NOT NULL,
			"rank"		INTEGER
		);
		
		CREATE INDEX IF NOT EXISTS 
		"balanceAccount" ON "Balances" 
		("account");`
	)
}

export function get({account, trustline}){
	return this.get(
		`SELECT * FROM Balances
		WHERE account = ?
		AND trustline = ?`,
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


	return this.insert(
		'Balances',
		{
			account: accountId,
			trustline: trustlineId,
			balance
		},
		{
			duplicate: {
				keys: ['account', 'trustline'],
				update: true
			}
		}
	)
}