export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Updates" (
			"type"		TEXT NOT NULL,
			"subject"	INTEGER NOT NULL,
			"updates"	STRING NOT NULL,
			UNIQUE("type", "subject")
		);`
	)
}

