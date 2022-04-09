export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "LedgerCaptures" (
			"index"		INTEGER NOT NULL UNIQUE,
			"date"		INTEGER NOT NULL,
			"txs"		INTEGER NOT NULL,
			"trusts"	INTEGER NOT NULL,
			"untrusts"	INTEGER NOT NULL,
			"pays"		INTEGER NOT NULL,
			"offers"	INTEGER NOT NULL,
			"cancels"	INTEGER NOT NULL,
			"fees"		INTEGER NOT NULL,
			"accounts"	INTEGER NOT NULL,
			PRIMARY KEY ("index")
		);

		CREATE INDEX IF NOT EXISTS 
		"LedgerCapturesDate" ON "LedgerCaptures" 
		("date");`
	)
}


export function insert(data){
	return this.insert({
		table: 'LedgerCaptures',
		data,
		duplicate: 'update'
	})
}