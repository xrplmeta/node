import path from 'path'
import { Database } from '@dbkit/sqlite'
import EventEmitter from '../../common/events.js'
import { wait, unixNow } from '../../common/time.js'
import { log } from '../../common/logging.js'


const setupQuery = `
CREATE TABLE IF NOT EXISTS "Metas" (
	"id"		INTEGER NOT NULL UNIQUE,
	"type"		TEXT NOT NULL,
	"subject"	INTEGER NOT NULL,
	"key"		TEXT NOT NULL,
	"value"		TEXT,
	"source"	TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE TABLE IF NOT EXISTS "Operations" (
	"id"		INTEGER NOT NULL UNIQUE,
	"type"		TEXT NOT NULL,
	"subject"	TEXT NOT NULL,
	"start"		INTEGER NOT NULL,
	"end"		INTEGER NOT NULL,
	"result"	TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
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

CREATE TABLE IF NOT EXISTS "TrustlineStats" (
	"id"		INTEGER NOT NULL UNIQUE,
	"trustline"	INTEGER NOT NULL,
	"date"		INTEGER NOT NULL,
	"count"		INTEGER NOT NULL,
	"issued"	TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE TABLE IF NOT EXISTS "Exchanges" (
	"tx"		BLOB NOT NULL UNIQUE,
	"date"		INTEGER NOT NULL,
	"from"		INTEGER NOT NULL,
	"to"		INTEGER NOT NULL,
	"price"		REAL NOT NULL,
	"volume"	REAL NOT NULL,
	"maker"		BLOB NOT NULL,
	PRIMARY KEY("tx")
);

CREATE TABLE IF NOT EXISTS "ExchangeCoverage" (
	"id"			INTEGER NOT NULL UNIQUE,
	"address"		TEXT,
	"headTx"		TEXT,
	"headDate"		INTEGER,
	"tailTx"		TEXT,
	"tailDate"		INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT)
);
`


export default class Repo extends EventEmitter{
	constructor(config){
		super()

		this.config = config
		this.log = log.for({name: 'repo', color: 'yellow'})
	}

	async open(){
		let file = path.join(this.config.dir, 'meta.db')

		this.db = new Database({file})
		this.db.exec(setupQuery)

		this.log(`opened database: ${file}`)
	}

	async setTrustlines(t, trustlines){
		let issuerRows = await this.db.insert(
			'Issuers',
			trustlines.map(trustline => ({
				address: trustline.issuer
			})),
			{
				duplicate: {ignore: true}
			}
		)

		let trustlineRows = await this.db.insert(
			'Trustlines',
			trustlines.map((trustline, i) => ({
				currency: trustline.currency,
				issuer: issuerRows[i].id
			})),
			{
				duplicate: {ignore: true}
			}
		)

		await this.db.insert(
			'TrustlineStats',
			trustlines.map((trustline, i) => ({
				date: t,
				trustline: trustlineRows[i].id,
				count: trustline.count,
				issued: trustline.issued
			})),
		)
	}

	async setMetas(metas){
		let rows = []

		for(let meta of metas){
			let subject

			switch(meta.type){
				case 'issuer':
					subject = this.db.getv(`SELECT id FROM Issuers WHERE address = ?`, meta.subject)
					break
			}

			if(!meta.meta)
				continue

			for(let [key, value] of Object.entries(meta.meta)){
				rows.push({
					type: meta.type,
					subject,
					key,
					value,
					source: meta.source
				})
			}
		}

		await this.db.insert(
			'Metas',
			rows,
			{
				duplicate: {
					keys: ['type', 'subject', 'key', 'source'],
					update: true
				}
			}
		)
	}


	getTrustline(by){
		if(by.currency && by.issuer){
			return this.db.get(`SELECT * FROM Trustlines WHERE currency=? AND issuer=?`, by.currency, by.issuer)
		}
	}


	async isOperationDue(type, subject, interval){
		let last = await this.getLastOperationFor(type, subject)

		if(!last)
			return true

		if(last.result !== 'success')
			return true

		return last.start + interval < unixNow()
	}

	async getMostRecentOperation({type, subject}){
		return await this.db.get(`SELECT * FROM Operations WHERE type=? AND subject=?`, type, subject)
	}

	async recordOperation(type, subject, promise){
		let start = unixNow()
		let result

			await promise
		try{
			result = 'success'
		}catch(error){
			this.log(`operation "${type}/${subject}" failed: ${error.toString()}`)
			result = `error: ${error.toString()}`
		}

		await this.db.insert('Operations', {
			type,
			subject,
			start,
			end: unixNow(),
			result
		})
	}
}


/*import path from 'path'
import Database from 'better-sqlite3'
import Rest from '../shared/rest.js'
import EventEmitter from '../shared/events.js'
import { log, wait, unixNow, currencyCodeForHumans } from '../shared/utils.js'


const setupQuery = `
CREATE TABLE IF NOT EXISTS "Currencies" (
	"id"			INTEGER NOT NULL UNIQUE,
	"currency"		TEXT NOT NULL,
	"issuer"		TEXT NOT NULL,
	"trustlines"	INTEGER NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE TABLE IF NOT EXISTS "Metas" (
	"id"		INTEGER NOT NULL UNIQUE,
	"type"		TEXT NOT NULL,
	"subject"	TEXT NOT NULL,
	"key"		TEXT NOT NULL,
	"value"		TEXT,
	"source"	TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE TABLE IF NOT EXISTS "Operations" (
	"id"		INTEGER NOT NULL UNIQUE,
	"type"		TEXT NOT NULL,
	"subject"	TEXT NOT NULL,
	"start"		INTEGER NOT NULL,
	"end"		INTEGER NOT NULL,
	"result"	TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
`

const statements = {
	selectCurrencies: `SELECT * FROM Currencies`,
	selectLastOperation: `SELECT * FROM Operations WHERE type=@type AND subject=@subject ORDER BY end DESC LIMIT 1`,
	insertOperation: `INSERT INTO Operations (type, subject, start, end, result) VALUES (@type, @subject, @start, @end, @result)`,
	selectCurrency: `SELECT * FROM Currencies WHERE currency=@currency AND issuer=@issuer`,
	updateCurrency: `UPDATE Currencies SET trustlines=@trustlines WHERE id=@id`,
	insertCurrency: `INSERT INTO Currencies (currency, issuer, trustlines) VALUES (@currency, @issuer, @trustlines)`,
	selectMeta: `SELECT id FROM Metas WHERE type=@type AND subject=@subject AND key=@key AND source=@source`,
	updateMeta: `UPDATE Metas SET value=@value WHERE id=@id`,
	deleteMeta: `DELETE FROM Metas WHERE id=@id`,
	insertMeta: `INSERT INTO Metas (type, subject, key, value, source) VALUES (@type, @subject, @key, @value, @source)`,
	selectIssuerByOldestOperation: 
		`SELECT 
			DISTINCT issuer, 
			(SELECT end FROM Operations WHERE type=@type AND subject=issuer ORDER BY end DESC LIMIT 1) as end
		FROM 
			Currencies 
		ORDER BY end ASC, trustlines DESC
		LIMIT 1`,
	selectIssuerHavingEmailByOldestOperation: 
		`SELECT 
			DISTINCT issuer, 
			value as emailHash, 
			(SELECT end FROM Operations WHERE type=@type AND subject=issuer ORDER BY end DESC LIMIT 1) as end
		FROM 
			Currencies 
			LEFT JOIN Metas 
				ON (Metas.type='issuer' AND Metas.subject=issuer AND key='emailHash' AND source='ledger') 
		WHERE 
			emailHash NOT NULL
		ORDER BY 
			end ASC, trustlines DESC
		LIMIT 1`
}


export default class Repo extends EventEmitter{
	constructor(){
		super()

		this.dir = process.env.DATA_DIR
		this.log = log.for({name: 'repo', color: 'yellow'})
	}

	async open(){
		let fullPath = path.join(this.dir, 'meta.db')

		this.db = new Database(fullPath)
		this.dbops = {}

		await this.db.exec(setupQuery)

		this.log(`opened database: ${fullPath}`)

		for(let [key, sql] of Object.entries(statements)){
			this.dbops[key] = this.db.prepare(sql)
		}

		this.setCurrency = this.db.transaction(currency => {
			let existing = this.dbops.selectCurrency.get(currency)

			if(existing){
				this.dbops.updateCurrency.run({...existing, ...currency})
			}else{
				this.dbops.insertCurrency.run(currency)
			}
		})

		this.setMeta = this.db.transaction(meta => {
			for(let [key, value] of Object.entries(meta.meta)){
				let row = {...meta, key, value}
				let existing = this.dbops.selectMeta.get(row)

				if(existing){
					if(value)
						this.dbops.updateMeta.run({...existing, ...row})
					else
						this.dbops.deleteMeta.run(existing)
				}else{
					if(value)
						this.dbops.insertMeta.run(row)
				}
			}
		})

		this.setCurrencies = this.db.transaction(currencies => 
			currencies.forEach(currency => this.setCurrency(currency))
		)

		this.setMetas = this.db.transaction(metas => 
			metas.forEach(meta => this.setMeta(meta))
		)
	}

	async getCurrencies(){
		return this.dbops.selectCurrencies.all()
			.map(currency => ({
				currency: currency.currency,
				issuer: currency.issuer,
				trustlines: currency.trustlines
			}))
	}

	async recordOperation(type, subject, promise){
		let start = unixNow()
		let result

		try{
			await promise
			result = 'success'
		}catch(error){
			this.log(`operation ${type}/${subject} failed: \n${error.toString()}`)
			result = 'error'
		}

		this.dbops.insertOperation.run({
			type,
			subject,
			start,
			end: unixNow(),
			result
		})
	}

	async getLastOperationFor(type, subject){
		return this.dbops.selectLastOperation.get({type, subject})
	}

	async isOperationDue(type, subject, interval){
		let last = await this.getLastOperationFor(type, subject)

		if(!last)
			return true

		if(last.result !== 'success')
			return true

		return last.end + interval < unixNow()
	}

	async getNextDueIssuerForOperation(type, interval, special){
		let next

		switch(special){
			case 'having-email':
				next = this.dbops.selectIssuerHavingEmailByOldestOperation.get({type})
				break

			default:
				next = this.dbops.selectIssuerByOldestOperation.get({type})
				break
		}

		if(next.end && next.end + interval >= unixNow())
			return null

		return next
	}
}*/