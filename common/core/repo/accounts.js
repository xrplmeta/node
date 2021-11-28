import codec from 'ripple-address-codec'

export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Accounts" (
			"id"		INTEGER NOT NULL UNIQUE,
			"address"	BLOB NOT NULL UNIQUE,
			"domain"	TEXT,
			"emailHash"	TEXT,
			PRIMARY KEY("id" AUTOINCREMENT)
		);

		CREATE UNIQUE INDEX IF NOT EXISTS 
		"accountAddress" ON "Accounts" 
		("address");`
	)
}

export function require(address){
	if(typeof address === 'number')
		return address

	return this.insert(
		'Accounts',
		{
			address: typeof address === 'string'
				? codec.decodeAccountID(address)
				: address,
		},
		{
			duplicate: {
				keys: ['address'],
				ignore: true
			}
		}
	).id
}

export function get(by){
	if(by.id){
		return this.get(
			`SELECT * FROM Accounts
			WHERE id = ?`,
			by.id
		)
	}else if(by.address){
		return this.get(
			`SELECT * FROM Accounts
			WHERE address = ?`,
			by.address
		)
	}
}

export function insert({address, domain, emailHash}){
	return this.insert(
		'Accounts',
		{
			address: typeof address === 'string'
				? codec.decodeAccountID(address)
				: address,
			domain,
			emailHash
		},
		{
			duplicate: {
				keys: ['address'],
				update: true
			}
		}
	)
}