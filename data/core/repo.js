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

CREATE UNIQUE INDEX IF NOT EXISTS "C+I" ON "Trustlines" (
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

CREATE INDEX IF NOT EXISTS "T" ON "Stats" (
	"trustline"
);

CREATE INDEX IF NOT EXISTS "D" ON "Stats" (
	"date"
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
`


export default class Repo extends EventEmitter{
	constructor(config){
		super()

		this.config = config
		this.log = log.for('repo', 'yellow')
	}

	async open(){
		let file = path.join(this.config.data.dir, 'meta.db')

		this.db = new Database({file})
		this.db.exec(setupQuery)

		this.log(`opened database: ${file}`)
	}

	async setStats(t, trustlines, replaceLatest){
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

		if(replaceLatest){
			for(let {id} of trustlineRows){
				await this.db.run(
					`DELETE FROM Stats
					WHERE trustline = ?
					ORDER BY date DESC
					LIMIT 1`,
					id
				)
			}
		}

		await this.db.insert(
			'Stats',
			trustlines.map((trustline, i) => ({
				date: t,
				trustline: trustlineRows[i].id,
				accounts: trustline.accounts,
				supply: trustline.supply,
				buy: trustline.buy,
				sell: trustline.sell,
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

	async getMetas(type, subject){
		return await this.db.all(
			`SELECT key, value, source
			FROM Metas
			WHERE type = ? AND subject = ?`,
			type, subject
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
					case 'currency':
						meta.subject = (await this.getTrustline(meta.subject, true)).id
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
				(SELECT address FROM Issuers WHERE Issuers.id = issuer) as issuer,
				issuer as issuerId
			FROM Trustlines`, 
		)
	}

	async getTrustline(by, createIfNonExistent){
		if(by.currency && by.issuer){
			let issuer = await this.getIssuer({address: by.issuer}, createIfNonExistent)

			if(!issuer)
				return null

			let trustline = this.db.get(
				`SELECT * 
				FROM Trustlines 
				WHERE currency=? AND issuer=?`, 
				by.currency, issuer.id
			)

			if(!trustline && createIfNonExistent)
				trustline = await this.db.insert(
					'Trustlines',
					{
						currency: by.currency, 
						issuer: issuer.id
					}
				)

			return trustline
		}
	}

	async getRecentStats(trustline, t){
		if(t === undefined){
			return await this.db.get(
				`SELECT *
				FROM Stats
				WHERE trustline = ?
				ORDER BY date DESC`,
				trustline.id
			)
		}else{
			let gridT = Math.floor(t / this.config.ledger.historyInterval) * this.config.ledger.historyInterval

			return await this.db.get(
				`SELECT *
				FROM Stats
				WHERE trustline = ?
				AND date >= ?
				ORDER BY date ASC`,
				trustline.id,
				gridT
			)
		}
		
	}


	async insertExchanges(exchanges){
		for(let exchange of exchanges){
			let tx = Buffer.from(exchange.tx, 'hex')
			let from = exchange.from.currency !== 'XRP' 
				? (await this.getTrustline(exchange.from, true)).id
				: 0
			let to = exchange.to.currency !== 'XRP' 
				? (await this.getTrustline(exchange.to, true)).id
				: 0

			await this.db.insert(
				'Exchanges',
				{
					tx,
					date: exchange.date,
					from,
					to,
					price: exchange.price,
					volume: exchange.volume,
					maker: exchange.maker.slice(1, 6)
				},
				{
					duplicate: {
						keys: ['tx'], 
						ignore: true
					}
				}
			)
		}
	}


	async getExchanges(base, quote){
		return await this.db.all(
			`SELECT *
			FROM Exchanges 
			WHERE 
			(\`from\` = @base AND \`to\` = @quote)
			OR
			(\`from\` = @quote AND \`to\` = @base)
			ORDER BY date ASC`, 
			{base, quote}
		)
	}

	async getExchangesCoverage(base, quote){
		return await this.db.all(
			`SELECT MIN(date) as min, MAX(date) as max
			FROM Exchanges 
			WHERE 
			(\`from\` = @base AND \`to\` = @quote)
			OR
			(\`from\` = @quote AND \`to\` = @base)
			ORDER BY date ASC`, 
			{base, quote}
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

	async hasSuccessfulOperation(type, subject){
		let operation = await this.getMostRecentOperation(type, subject)

		if(operation && operation.result === 'success')
			return true

		return false
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

		let mostRecent = await this.getMostRecentOperation(type, subject)

		if(mostRecent){
			await this.db.run(
				`DELETE FROM Operations
				WHERE id = ?`,
				mostRecent.id
			)
		}

		await this.markOperation(type, subject, start, result)
	}

	async markOperation(type, subject, start, result){
		await this.db.insert('Operations', {
			type,
			subject,
			start,
			end: unixNow(),
			result
		})
	}
}