import fs from 'fs'
import path from 'path'
import Database from './db.js'
import { log } from '../lib/log.js'
import EventEmitter from '../lib/events.js'
import * as submodules from './repo/index.js'
import { wait, unixNow } from '../lib/time.js'


export default class Repo extends EventEmitter{
	constructor(config){
		super()

		this.config = config

		for(let [key, submodule] of Object.entries(submodules)){
			this[key] = Object.entries(submodule)
				.reduce(
					(methods, [key, method]) => ({
						...methods, 
						[key]: method.bind(this)
					}),
					{}
				)
		}
	}

	async open(){
		let file = path.join(this.config.data.dir, 'meta.db')

		this.db = new Database({file})
		this.db.pragma(`journal_mode=WAL`)
		
		this.structure.ensure()

		log.info(`opened database: ${file}`)
	}

	async monitorWAL(interval, maxSize){
		log.info(`monitoring WAL file`)

		let file = path.join(this.config.data.dir, 'meta.db-wal')

		while(true){
			await wait(interval)

			try{
				let stat = fs.statSync(file)

				log.debug(`WAL file is ${stat.size} bytes`)

				if(stat.size > maxSize){
					log.info(`WAL file exceeds max size of ${maxSize}`)
					await this.flushWAL()
				}
			}catch(e){
				log.error(`could not check WAL file:\n`, e)
			}
		}
	}

	async flushWAL(){
		log.info(`force flushing WAL file...`)

		this.db.pragma(`wal_checkpoint(TRUNCATE)`)

		log.info(`WAL flushed`)
	}
	

	async getTableHeads(){
		return {
			Trustlines: await this.db.getv(`SELECT MAX(id) FROM Trustlines`),
			Stats: await this.db.getv(`SELECT MAX(id) FROM Stats`),
			Metas: await this.db.getv(`SELECT MAX(id) FROM Metas`),
			Exchanges: await this.db.getv(`SELECT MAX(id) FROM Exchanges`),
		}
	}

	async getTableEntriesAfter(table, id){
		return await this.db.all(
			`SELECT *
			FROM ${table}
			WHERE id > ?`,
			id
		)
	}
}