import codec from 'ripple-address-codec'

export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Offers" (
			"account"	INTEGER NOT NULL,
			"base"		INTEGER,
			"quote"		INTEGER,
			"gets"		TEXT NOT NULL,
			"pays"		TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS 
		"offerAccount" ON "Offers" 
		("account");`
	)
}


export function insert({account, base, quote, gets, pays}){
	let accountId = this.accounts.require(account)
	let baseId = base
		? this.trustlines.require(base)
		: null
	let quoteId = quote
		? this.trustlines.require(quote)
		: null


	return this.insert(
		'Offers',
		{
			account: accountId,
			base: baseId,
			quote: quoteId,
			gets,
			pays
		},
		{
			duplicate: {
				keys: ['account', 'base', 'quote'],
				update: true
			}
		}
	)
}