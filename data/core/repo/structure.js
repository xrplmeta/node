const structSQL = `
CREATE TABLE IF NOT EXISTS "Metas" (
	"id"		INTEGER NOT NULL UNIQUE,
	"type"		TEXT NOT NULL,
	"subject"	INTEGER NOT NULL,
	"key"		TEXT NOT NULL,
	"value"		TEXT,
	"source"	TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE INDEX IF NOT EXISTS "Metas-T+S" ON "Metas" (
	"type",
	"subject"
);

CREATE TABLE IF NOT EXISTS "Operations" (
	"id"		INTEGER NOT NULL UNIQUE,
	"type"		TEXT NOT NULL,
	"subject"	TEXT,
	"start"		INTEGER NOT NULL,
	"end"		INTEGER NOT NULL,
	"result"	TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE INDEX IF NOT EXISTS "Operations-T+S" ON "Operations" (
	"type",
	"subject"
);

CREATE TABLE IF NOT EXISTS "Issuers" (
	"id"			INTEGER NOT NULL UNIQUE,
	"address"		TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE TABLE IF NOT EXISTS "Trustlines" (
	"id"			INTEGER NOT NULL UNIQUE,
	"currency"		TEXT NOT NULL,
	"issuer"		INTEGER NOT NULL,
	"inception"		INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE UNIQUE INDEX IF NOT EXISTS "Trustlines-C+I" ON "Trustlines" (
	"currency",
	"issuer"
);

CREATE TABLE IF NOT EXISTS "Stats" (
	"id"		INTEGER NOT NULL UNIQUE,
	"trustline"	INTEGER NOT NULL,
	"date"		INTEGER NOT NULL,
	"accounts"	INTEGER NOT NULL,
	"supply"	TEXT NOT NULL,
	"buy"		TEXT NOT NULL,
	"sell"		TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE INDEX IF NOT EXISTS "Stats-T" ON "Stats" (
	"trustline"
);

CREATE INDEX IF NOT EXISTS "Stats-D" ON "Stats" (
	"date"
);

CREATE TABLE IF NOT EXISTS "Whales" (
	"id"		INTEGER NOT NULL UNIQUE,
	"trustline"	INTEGER NOT NULL,
	"address"	TEXT NOT NULL,
	"balance"	TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE INDEX IF NOT EXISTS "Whales-T" ON "Whales" (
	"trustline"
);


CREATE TABLE IF NOT EXISTS "Distributions" (
	"id"		INTEGER NOT NULL UNIQUE,
	"trustline"	INTEGER NOT NULL,
	"date"		INTEGER NOT NULL,
	"percent"	REAL NOT NULL,
	"share"		REAL NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE INDEX IF NOT EXISTS "Distributions-T" ON "Distributions" (
	"trustline"
);

CREATE TABLE IF NOT EXISTS "Exchanges" (
	"id"		INTEGER NOT NULL UNIQUE,
	"tx"		BLOB NOT NULL UNIQUE,
	"date"		INTEGER NOT NULL,
	"from"		INTEGER NOT NULL,
	"to"		INTEGER NOT NULL,
	"price"		REAL NOT NULL,
	"volume"	REAL NOT NULL,
	"maker"		BLOB NOT NULL,
	PRIMARY KEY("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Exchanges-T" ON "Exchanges" (
	"tx"
);

CREATE INDEX IF NOT EXISTS "Exchanges-F+T" ON "Exchanges" (
	"from",
	"to"
);
`


export async function ensure(){
	await this.db.exec(structSQL)
}