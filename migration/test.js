import DB from '@xrplmeta/common/lib/db.js'

let db = new DB({
	file: 'test.db'
})


db.exec(`
	CREATE TABLE IF NOT EXISTS "Test" (
		"id"		INTEGER NOT NULL UNIQUE,
		"key1"	TEXT NOT NULL,
		"key2"	TEXT NOT NULL,
		"value"	TEXT,
		PRIMARY KEY ("id" AUTOINCREMENT),
		UNIQUE ("key1", "key2")
	);
`)

db.insert({
	table: 'Test',
	data: {
		key1: 'a',
		key2: 'b',
		value: 'x'
	},
	duplicate: 'replace'
})

console.log(db.all(`SELECT * FROM Test`))