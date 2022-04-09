export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "LedgerSnapshots" (
			"index"			INTEGER NOT NULL UNIQUE,
			"accounts"		INTEGER NOT NULL,
			"trustlines"	INTEGER NOT NULL,
			"tokens"		INTEGER NOT NULL,
			"offers"		INTEGER NOT NULL,
			"liquidity"		INTEGER NOT NULL,
			PRIMARY KEY ("index")
		);`
	)
}


export function insert(data){
	return this.insert({
		table: 'LedgerSnapshots',
		data,
		duplicate: 'update'
	})
}