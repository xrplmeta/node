import codec from 'ripple-address-codec'

export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Offers" (
			"account"	INTEGER NOT NULL,
			"base"		INTEGER,
			"quote"		INTEGER,
			"gets"		TEXT NOT NULL,
			"pays"		TEXT NOT NULL,
			UNIQUE ("account", "base", "quote")
		);

		CREATE INDEX IF NOT EXISTS 
		"offerAccount" ON "Offers" 
		("account");`
	)
}


export function insert({account, base, quote, gets, pays}){
	let accountId = this.accounts.id(account)
	let baseId = base
		? this.trustlines.id(base)
		: null
	let quoteId = quote
		? this.trustlines.id(quote)
		: null

	return this.insert({
		table: 'Offers',
		data: {
			account: accountId,
			base: baseId,
			quote: quoteId,
			gets,
			pays
		},
		duplicate: 'update'
	})
}

export function count(){
	return this.getv(`SELECT COUNT(1) FROM Offers`)
}