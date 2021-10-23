import path from 'path'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import Rest from '../shared/rest.js'
import EventEmitter from '../shared/events.js'
import { log, wait, unixNow } from '../shared/utils.js'

export default class Repo extends EventEmitter{
	constructor(dir){
		super()

		this.dir = dir
		this.log = log.for({name: 'repo', color: 'yellow'})
	}

	async open(){
		let fullPath = path.join(this.dir, 'main.db')

		this.db = await open({
			filename: fullPath,
			driver: sqlite3.Database
		})

		this.log(`opened database: ${fullPath}`)

		await this.db.run(
			`CREATE TABLE IF NOT EXISTS "Trustlines" (
				"id"	INTEGER NOT NULL UNIQUE,
				"currency"	TEXT NOT NULL,
				"issuer"	TEXT NOT NULL,
				"holders"	INTEGER NOT NULL,
				PRIMARY KEY("id" AUTOINCREMENT)
			)`
		)

		await this.db.run(
			`CREATE TABLE IF NOT EXISTS "Operations" (
				"id"	INTEGER NOT NULL UNIQUE,
				"type"	TEXT NOT NULL,
				"subject"	TEXT NOT NULL,
				"start"	INTEGER NOT NULL,
				"end"	INTEGER NOT NULL,
				"result"	TEXT NOT NULL,
				PRIMARY KEY("id" AUTOINCREMENT)
			)`
		)
	}

	async recordOperation(type, subject, promise){
		let start = unixNow()
		let end
		let result

		try{
			await promise
			result = 'success'
		}catch(error){
			this.log(`operation ${type}/${subject} failed: ${error.message}`)
			result = 'error'
		}

		end = unixNow()

		await this.db.run(
			`INSERT INTO Operations (type, subject, start, end, result) VALUES (?, ?, ?, ?, ?)`,
			type,
			subject,
			start,
			end,
			result
		)
	}

	async getLastOperationFor(type, subject){
		return await this.db.get(`SELECT * FROM Operations WHERE type=? AND subject=? ORDER BY end DESC LIMIT 1`, type, subject)
	}

	async isOperationDue(type, subject, interval){
		let last = await this.getLastOperationFor(type, subject)

		if(!last)
			return true

		if(last.result !== 'success')
			return true

		return last.end + interval < unixNow()
	}

	async registerTrustline({currency, issuer, holders}){
		let existing = await this.db.get(
			`SELECT id 
			FROM Trustlines 
			WHERE currency=? AND issuer=?`,
			currency,
			issuer
		)

		if(existing){
			await this.db.run(
				`UPDATE Trustlines
				SET holders=?
				WHERE id=?`,
				holders,
				existing.id
			)
		}else{
			await this.db.run(
				`INSERT INTO Trustlines
				(currency, issuer, holders)
				VALUES
				(?, ?, ?)`,
				currency, 
				issuer, 
				holders
			)
		}
	}
}