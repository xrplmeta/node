import fs from 'fs'
import path from 'path'
import Adapter from 'better-sqlite3'
import { wait } from '../lib/time.js'
import { log } from '../lib/log.js'


export default class{
	constructor(config){
		this.file = config.file
		this.fileName = path.basename(config.file)
		this.con = new Adapter(config.file)
		this.statementCache = {}

		if(config.journalMode)
			this.pragma(`journal_mode=${config.journalMode}`)

		if(config.cacheSize)
			this.pragma(`cache_size=${config.cacheSize}`)

		for(let [key, mod] of Object.entries(config.modules)){
			this[key] = Object.entries(mod)
				.reduce(
					(methods, [key, method]) => ({
						...methods, 
						[key]: method.bind(this)
					}),
					{}
				)

			if(this[key].init)
				this[key].init()
		}
	}

	pragma(sql){
		log.debug(`sql pragma: ${sql}`)
		return this.con.pragma(sql)
	}

	exec(sql){
		log.debug(`sql exec: ${sql}`)
		return this.con.exec(sql)
	}

	prepare(sql){
		if(this.statementCache[sql])
			return this.statementCache[sql]

		return this.statementCache[sql] = this.con.prepare(sql)
	}

	iterate(sql, ...params){
		log.debug(`sql iter: ${sql}`, params)
		return this.prepare(sql).iterate(...params)
	}

	get(sql, ...params){
		log.debug(`sql get: ${sql}`, params)
		return this.prepare(sql).get(...params)
	}

	getv(sql, ...params){
		let res = this.get(sql, ...params)
		return res[Object.keys(res)[0]]
	}

	all(sql, ...params){
		log.debug(`sql all: ${sql}`, params)
		return this.prepare(sql).all(...params)
	}

	allv(sql, ...params){
		let rows = this.all(sql, ...params)
			
		if(rows.length === 0)
			return []

		let key = Object.keys(rows[0])[0]

		return rows.map(row => row[key])
	}

	run(sql, ...params){
		log.debug(`sql run: ${sql}`, params)
		return this.prepare(sql).run(...params)
	}

	insert({table, data, duplicate, returnRow}){
		if(Array.isArray(data)){
			return this.tx(() => {
				let rows = []

				for(let item of data){
					rows.push(this.insert({table, data: item, duplicate, returnRow}))
				}

				return rows
			})
		}else{
			let modifier = (duplicate || 'fail').toUpperCase()
			let getExisting = () => {
				let compares = Object.keys(data)
					.map(key => `\`${key}\` IS @${key}`)

				return this.get(
					`SELECT * FROM ${table}
					WHERE ${compares.join(` AND `)}`,
					data
				)
			}

			if(modifier === 'REPLACE'){
				let existing = getExisting()

				if(existing)
					return existing
			}


			if(modifier === 'UPDATE'){
				var info = this.run(
					`INSERT INTO ${table}
					(${Object.keys(data).map(key => `\`${key}\``).join(',')})
					VALUES
					(${Object.keys(data).map(key => `@${key}`).join(',')})
					ON CONFLICT DO UPDATE SET
					${Object.keys(data).map(key => `\`${key}\`=@${key}`).join(',')}`,
					data
				)
			}else{
				var info = this.run(
					`INSERT OR ${modifier} INTO ${table}
					(${Object.keys(data).map(key => `\`${key}\``).join(',')})
					VALUES
					(${Object.keys(data).map(key => `@${key}`).join(',')})`,
					data
				)
			}

			if(returnRow){
				if(info && info.lastInsertRowid){
					return this.get(
						`SELECT * FROM ${table} 
						WHERE rowid = ?`, 
						info.lastInsertRowid
					)
				}else{
					return getExisting()
				}
			}
		}
	}

	async tx(func){
		if(this.inTx)
			return await func()

		log.debug(`sql tx begin`)

		while(true){
			try{
				this.con.exec('BEGIN IMMEDIATE')
				this.inTx = true
				break
			}catch(e){
				if(e.code !== 'SQLITE_BUSY' && e.code !== 'SQLITE_BUSY_SNAPSHOT'){
					throw e
				}

				log.info(`sql busy`)
				await wait(3000)
			}
		}
		
		try{
			var ret = await func()

			log.debug(`sql tx commit`)
			this.con.exec('COMMIT')
		}catch(error){
			log.debug(`sql tx begin`)
			this.con.exec('ROLLBACK')

			throw error
		}finally{
			this.inTx = false
		}

		return ret
	}

	async monitorWAL(interval, maxSize){
		log.info(`monitoring WAL file`)

		while(true){
			await wait(interval)

			try{
				let stat = fs.statSync(`${this.file}-wal`)

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

	flushWAL(){
		log.info(`force flushing WAL file...`)

		this.pragma(`wal_checkpoint(TRUNCATE)`)

		log.info(`WAL flushed`)
	}

	enableQueryProfiling(){
		for(let fnName of ['get', 'all', 'run']){
			let fn = this[fnName]

			this[fnName] = (sql, ...params) => {
				let start = process.hrtime()
				let res = fn.call(this, sql, ...params)
				let time = process.hrtime(start)
				let timeInMs = (time[0] * 1000000000 + time[1]) / 1000000
				let formatted = sql.replace(/(\s{2,})|(\n)/g, ' ').slice(0, 100)

				log.info(`${this.fileName} query (${timeInMs}ms): ${formatted}`)

				return res
			}
		}
	}
}