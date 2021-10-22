import path from 'path'
import fetch from 'node-fetch'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import Rest from '../shared/rest.js'
import EventEmitter from '../shared/events.js'
import { log, wait } from '../shared/utils.js'

export default class Repo extends EventEmitter{
	constructor(dir){
		super()

		this.dir = dir
		this.log = log.for({name: 'repo', color: 'yellow'})
	}

	async open(){
		while(true){
			this.log(`fetching assets list from ${this.metaApiUrl}...`)

			try{
				this.assets = await this.metaApi.get('currencies')
				break
			}catch(error){
				this.log(`failed to fetch assets list (${error.message}) - retrying 3s...`)
				await wait(3000)
			}
		}

		this.log(`got ${this.assets.length} assets`)

		for(let asset of this.assets){
			await this.getDatabaseFor(asset)
		}

		this.emit('open')
	}

	getAsset(asset){
		if(!asset)
			return null

		if(typeof asset === 'string'){
			let split = asset.split(':')

			asset = {
				currency: split[0],
				issuer: split[1]
			}
		}

		if(asset.currency === 'XRP')
			return asset

		return this.assets.find(a => a.currency === asset.currency && a.issuer === asset.issuer)
	}

	hasAsset(asset){
		return !!this.getAsset(asset)
	}


	async addExchange(asset, exchange){
		let database = await this.getDatabaseFor(asset)
		let tx = Buffer.from(exchange.tx, 'hex')

		if((await database.get(`SELECT COUNT(1) as count FROM Exchanges WHERE tx=?`, tx)).count > 0)
			return false

		await database.run(
			`INSERT INTO Exchanges 
			(tx, date, price, volume, maker, taker) 
			VALUES 
			(?, ?, ?, ?, ?, ?)`, 
			tx,
			exchange.date,
			exchange.price,
			exchange.volume,
			exchange.maker.slice(1, 6),
			exchange.taker.slice(1, 6)
		)

		return true
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

	async getHeadExchange(asset){
		let database = await this.getDatabaseFor(asset)

		return await database.get(
			`SELECT date, price, volume, maker, taker 
			FROM Exchanges 
			ORDER BY date DESC 
			LIMIT 1`
		)
	}

	async updateAllCoverageHeads(segment){
		for(let asset of this.assets){
			await this.updateCoverage(asset, segment)
		}
	}

	async updateCoverage(asset, segment){
		let database = await this.getDatabaseFor(asset)
		let intersecting = await database.all(
			`SELECT * FROM Coverage WHERE NOT (headDate<? OR tailDate>?)`,
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
			await database.run(`DELETE FROM Coverage WHERE id=?`, seg.id)
		}

		await database.run(
			`INSERT INTO Coverage 
			(tailDate, tailTx, headDate, headTx)
			VALUES
			(?, ?, ?, ?)`,
			newSpan.tailDate,
			newSpan.tailTx,
			newSpan.headDate,
			newSpan.headTx
		)
	}

	async getNextSyncSpan(issuer){
		let mostRecent = null

		for(let asset of this.assets){
			if(asset.issuer !== issuer)
				continue


			let database = await this.getDatabaseFor(asset)
			let span = await database.get(`SELECT tailDate, tailTx, headDate, headTx FROM Coverage ORDER BY tailDate DESC LIMIT 1`)

			if(span){
				if(!mostRecent || mostRecent.tailDate < span.tailDate){
					mostRecent = span
				}
			}
		}

		if(mostRecent){
			return mostRecent
		}else{
			let now = Math.floor(Date.now() / 1000)

			return {
				tailDate: now,
				headDate: now
			}
		}
	}

	async getAccumulatedExchangeVolume(asset, {start, end}){
		let database = await this.getDatabaseFor(asset)
		let result = await database.get(
			`SELECT SUM(volume) as volume
			FROM Exchanges
			WHERE date>=? AND date<=?`,
			start,
			end
		)
		
		return result.volume
	}

	async getExchangesCount(asset, {start, end}){
		let database = await this.getDatabaseFor(asset)
		let result = await database.get(
			`SELECT COUNT(1) as count
			FROM Exchanges
			WHERE date>=? AND date<=?`,
			start,
			end
		)
		
		return result.count
	}

	async getUniqueTradersCount(asset, {start, end}){
		let database = await this.getDatabaseFor(asset)
		let makers = await database.all(
			`SELECT DISTINCT maker
			FROM Exchanges
			WHERE date>=? AND date<=?`,
			start,
			end
		)
		let takers = await database.all(
			`SELECT DISTINCT taker
			FROM Exchanges
			WHERE date>=? AND date<=?`,
			start,
			end
		)

		return new Set([...makers, ...takers]).size
	}


	async getDatabaseFor(asset){
		let key = `${asset.currency}:${asset.issuer}`

		if(this.databases[key])
			return this.databases[key]

		let file = `${asset.currency}-${asset.issuer}.db`
		let fullPath = path.join(this.dir, file)
		let database = await open({
			filename: fullPath,
			driver: sqlite3.Database
		})

		this.log(`opened database: ${fullPath}`)

		await this.ensureStructure(database)

		this.databases[key] = database

		return database
	}

	async ensureStructure(database){
		await database.run(
			`CREATE TABLE IF NOT EXISTS "Exchanges" (
				"tx"		BLOB NOT NULL UNIQUE,
				"date"		INTEGER NOT NULL,
				"price"		REAL NOT NULL,
				"volume"	REAL NOT NULL,
				"maker"		BLOB NOT NULL,
				"taker"		BLOB NOT NULL,
				PRIMARY KEY("tx")
			);`
		)

		await database.run(
			`CREATE TABLE IF NOT EXISTS "Coverage" (
				"id"			INTEGER NOT NULL UNIQUE,
				"headTx"		TEXT,
				"headDate"		INTEGER,
				"tailTx"		TEXT,
				"tailDate"		INTEGER,
				PRIMARY KEY("id" AUTOINCREMENT)
			);`
		)
	}

}