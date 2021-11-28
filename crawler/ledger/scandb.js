import fs from 'fs'
import DB from '../../common/lib/db.js'
import { log } from '../../common/lib/log.js'
import * as modules from './scandb/index.js'

const structure = `
CREATE TABLE "Accounts" (
	"id"		INTEGER NOT NULL UNIQUE,
	"address"	BLOB NOT NULL UNIQUE,
	"domain"	TEXT,
	"emailHash"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE TABLE IF NOT EXISTS "Balances" (
	"account"	INTEGER NOT NULL,
	"trustline"	INTEGER,
	"balance"	TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "Trustlines" (
	"id"		INTEGER NOT NULL UNIQUE,
	"issuer"	INTEGER NOT NULL,
	"currency"	TEXT NOT NULL,
	"supply"	TEXT NOT NULL DEFAULT "0",
	"count"		INTEGER NOT NULL DEFAULT "0",
	PRIMARY KEY("id" AUTOINCREMENT)
);
`

export default (file, inMemory) => {
	if(file !== ':memory:')
		if(fs.existsSync(file))
			fs.unlinkSync(file)

	return new DB({file, modules})
}