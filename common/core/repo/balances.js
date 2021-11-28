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