export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Heads" (
			"key"		INTEGER NOT NULL UNIQUE,
			"sequence"	INTEGER NOT NULL UNIQUE,
			PRIMARY KEY ("key" AUTOINCREMENT)
		);`
	)
}

