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
	"subject"	TEXT,
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

CREATE TABLE IF NOT EXISTS "Holdings" (
	"id"		INTEGER NOT NULL UNIQUE,
	"trustline"	INTEGER NOT NULL,
	"date"		INTEGER NOT NULL,
	"count"		INTEGER NOT NULL,
	"amount"	TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE TABLE IF NOT EXISTS "Whales" (
	"id"		INTEGER NOT NULL UNIQUE,
	"trustline"	INTEGER NOT NULL,
	"address"	TEXT NOT NULL,
	"balance"	TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE TABLE IF NOT EXISTS "Distributions" (
	"id"		INTEGER NOT NULL UNIQUE,
	"trustline"	INTEGER NOT NULL,
	"date"		INTEGER NOT NULL,
	"percent"	REAL NOT NULL,
	"share"		REAL NOT NULL,
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

CREATE TABLE IF NOT EXISTS "Coverage" (
	"id"			INTEGER NOT NULL UNIQUE,
	"issuer"		INTEGER,
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
		this.log = log.for('repo', 'yellow')
	}

	async open(){
		let file = path.join(this.config.dir, 'meta.db')

		this.db = new Database({file})
		this.db.exec(setupQuery)

		this.log(`opened database: ${file}`)
	}

	async setTrustlineHoldings(t, trustlines){
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
			'Holdings',
			trustlines.map((trustline, i) => ({
				date: t,
				trustline: trustlineRows[i].id,
				count: trustline.count,
				amount: trustline.amount
			})),
			{
				duplicate: {
					keys: ['trustline', 'date'], 
					update: true
				}
			}

		)
	}

	async setWhales({currency, issuer}, whales){
		let trustline = await this.getTrustline({currency, issuer}, true)

		await this.db.run(`DELETE FROM Whales WHERE trustline = ?`, trustline.id)
		await this.db.insert(
			'Whales',
			whales.map(whale => ({
				trustline: trustline.id,
				address: whale.address,
				balance: whale.balance
			}))
		)
	}

	async setDistributions(t, {currency, issuer}, distributions){
		let trustline = await this.getTrustline({currency, issuer})

		await this.db.insert(
			'Distributions',
			distributions.map(distribution => ({
				trustline: trustline.id,
				date: t,
				percent: distribution.percent,
				share: distribution.share
			})),
			{
				duplicate: {
					keys: ['trustline', 'date', 'percent'],
					update: true
				}
			}
		)
	}

	async getMeta(type, subject, key, source){
		let metas = await this.db.all(
			`SELECT value, source
			FROM Metas
			WHERE type = ? AND subject = ? AND key = ?`,
			type, subject, key
		)

		if(metas.length === 0)
			return undefined

		return metas[0].value
	}

	async setMeta(meta){
		await this.setMetas([meta])
	}

	async setMetas(metas){
		let rows = []

		for(let meta of metas){
			if(!meta.meta)
				continue

			if(typeof meta.subject !== 'number'){
				switch(meta.type){
					case 'issuer':
						meta.subject = (await this.getIssuer({address: meta.subject}, true)).id
						break
				}
			}

			for(let [key, value] of Object.entries(meta.meta)){
				rows.push({
					type: meta.type,
					subject: meta.subject,
					source: meta.source,
					key,
					value,
				})
			}

			await wait(1)
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

	async getIssuer(by, createIfNonExistent){
		if(by.address){
			let issuer = await this.db.get(
				`SELECT * 
				FROM Issuers 
				WHERE address = ?`, 
				by.address
			)

			if(!issuer && createIfNonExistent)
				issuer = await this.db.insert(
					'Issuers',
					{address: by.address}
				)

			return issuer
		}else if(by.id){
			return await this.db.get(
				`SELECT * 
				FROM Issuers 
				WHERE id = ?`, 
				by.id
			)
		}
	}

	async getTrustlines(){
		return this.db.all(
			`SELECT 
				id,
				currency, 
				(SELECT address FROM Issuers WHERE Issuers.id = issuer) as issuer
			FROM Trustlines`, 
		)
	}

	async getTrustline(by){
		if(by.currency && by.issuer){
			let issuer = await this.getIssuer({address: by.issuer})

			if(!issuer)
				return null

			return this.db.get(
				`SELECT * 
				FROM Trustlines 
				WHERE currency=? AND issuer=?`, 
				by.currency, issuer.id
			)
		}
	}

	async addExchange(asset, exchange){
		let tx = Buffer.from(exchange.tx, 'hex')
		let from = exchange.from.currency === 'XRP' ? 0 : (await this.getTrustline(exchange.from)).id
		let to = exchange.to.currency === 'XRP' ? 0 : (await this.getTrustline(exchange.to)).id

		await this.db.insert(
			'Exchanges',
			{
				tx,
				from,
				to,
				date: exchange.date,
				price: exchange.price,
				volume: exchange.volume,
				maker: exchange.maker
			},
			{
				duplicate: {
					keys: ['tx'], 
					skip: true
				}
			}
		)
	}

	async getExchanges(asset, {start, end}){
		let database = await this.getDatabaseFor(asset)

		return await database.all(
			`SELECT date, price, volume, maker, taker 
			FROM Exchanges 
			WHERE date >=? AND date<=?
			ORDER BY date ASC`, 
			start, 
			end
		)
	}

	async getHeadExchange(issuerAddress){
		let issuer = await this.getIssuer({address: issuerAddress}, true)

		return await database.get(
			`SELECT * 
			FROM Exchanges 
			WHERE from = @issuer OR to = @issuer
			ORDER BY date DESC 
			LIMIT 1`,
			{issuer: issuer.id}
		)
	}

	async updateAllCoverageHeads(segment){
		let issuers = await this.db.all(
			`SELECT * 
			FROM Issuers
			WHERE (SELECT COUNT(1) FROM Trustlines WHERE Trustlines.issuer=Issuers.id) > 0`
		)

		for(let issuer of issuers){
			await this.updateCoverage(issuer, segment)
		}
	}

	async updateCoverage(issuer, segment){
		let issuerId = issuer.id ? issuer.id : await this.getIssuer(issuer, true)
		let intersecting = await database.all(
			`SELECT * FROM WHERE issuer=? AND Coverage NOT (headDate<? OR tailDate>?)`,
			issuerId,
			segment.tailDate,
			segment.headDate
		)
		let newSpan = {...segment}

		for(let seg of intersecting){
			if(seg.tailDate < newSpan.tailDate){
				newSpan.tailDate = seg.tailDate
				newSpan.tailTx = seg.tailTx
			}

			if(seg.headDate > newSpan.headDate){
				newSpan.headDate = seg.headDate
				newSpan.headTx = seg.headTx
			}
		}

		for(let seg of intersecting){
			await this.db.run(`DELETE FROM Coverage WHERE id=?`, seg.id)
		}

		await this.db.insert(
			'Coverage',
			{
				issuer: issuerId,
				tailDate: newSpan.tailDate,
				tailTx: newSpan.tailTx,
				headDate: newSpan.headDate,
				headTx: newSpan.headTx
			}
		)
	}

	async getMostRecentCoverageSpan(issuer){
		let issuerId = issuer.id ? issuer.id : await this.getIssuer(issuer, true)

		return await this.db.get(
			`SELECT *
			FROM Coverage 
			WHERE issuer=?
			ORDER BY tailDate DESC 
			LIMIT 1`,
			issuerId
		)
	}


	async getNextEntityOperation(type, entity){
		let table = 'Issuers'

		return await this.db.get(
			`SELECT
				Operations.*, ${table}.id as entity
			FROM
				${table}
				LEFT JOIN Operations
					ON 
						Operations.type = ?
						AND
						Operations.subject = (? || ':' || ${table}.id)
			GROUP BY
				Operations.subject
			ORDER BY
				(CASE WHEN start IS NULL THEN 1 ELSE 0 END) DESC,
				MAX(start) ASC`,
			type, entity
		)
	}

	async getMostRecentOperation(type, subject){
		if(subject){
			return await this.db.get(
				`SELECT * 
				FROM Operations 
				WHERE type=? AND subject=?
				ORDER BY start DESC`, 
				type, subject
			)
		}else{
			return await this.db.get(
				`SELECT * 
				FROM Operations 
				WHERE type=?
				ORDER BY start DESC`, 
				type
			)
		}
	}

	async recordOperation(type, subject, promise){
		let start = unixNow()
		let result

		try{
			await promise
			result = 'success'
		}catch(error){
			this.log(`operation "${type}/${subject}" failed: ${error.toString()}`)

			await wait(3000)

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