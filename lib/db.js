import fs from 'fs'
import path from 'path'
import Adapter from 'better-sqlite3'
import { wait } from '@xrplworks/time'
import log from './log.js'


export default class{
	constructor(config){
		this.config = config
		this.file = config.file
		this.fileName = path.basename(config.file)
		this.open()
	}
	

	open(){
		let config = this.config

		this.newlyCreated = !fs.existsSync(config.file)
		this.con = new Adapter(config.file, {readonly: config.readonly || false})
		this.statementCache = {}

		try{
			if(config.journalMode)
				this.pragma(`journal_mode=${config.journalMode}`)

			if(config.cacheSize)
				this.pragma(`cache_size=${config.cacheSize}`)
		}catch(e){
			if(e.code === 'SQLITE_CORRUPT'){
				this.corrupt = true
			}else{
				throw e
			}
		}
	}

	
	registerModules(modules){
		for(let [key, mod] of Object.entries(modules)){
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


	wipe(){
		this.close()

		fs.unlinkSync(this.file)

		if(fs.existsSync(`${this.file}-wal`))
			fs.unlinkSync(`${this.file}-wal`)

		if(fs.existsSync(`${this.file}-shm`))
			fs.unlinkSync(`${this.file}-shm`)

		this.open()
	}

	close(){
		this.con.close()
	}

	get version(){
		return this.pragma(`user_version`)[0].user_version
	}

	set version(v){
		return this.pragma(`user_version = ${v}`)
	}

	isEmpty(){
		return this.getv(`SELECT COUNT(1) FROM sqlite_master WHERE type='table'`) === 0
	}

	pragma(sql){
		return this.con.pragma(sql)
	}

	exec(sql){
		return this.con.exec(sql)
	}

	prepare(sql){
		if(this.statementCache[sql])
			return this.statementCache[sql]

		return this.statementCache[sql] = this.con.prepare(sql)
	}

	iterate(sql, ...params){
		return this.prepare(sql).iterate(...params)
	}

	get(sql, ...params){
		return this.prepare(sql).get(...params)
	}

	getv(sql, ...params){
		let res = this.get(sql, ...params)
		return res[Object.keys(res)[0]]
	}

	all(sql, ...params){
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
					(${Object.keys(data).map(key => `"${key}"`).join(',')})
					VALUES
					(${Object.keys(data).map(key => `@${key}`).join(',')})
					ON CONFLICT DO UPDATE SET
					${Object.keys(data).map(key => `"${key}"=@${key}`).join(',')}`,
					data
				)
			}else{
				var info = this.run(
					`INSERT OR ${modifier} INTO ${table}
					(${Object.keys(data).map(key => `"${key}"`).join(',')})
					VALUES
					(${Object.keys(data).map(key => `@${key}`).join(',')})`,
					data
				)
			}

			if(returnRow){
				if(info && info.changes > 0){
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

	tx(func){
		if(this.inTx)
			return func()

		log.debug(`sql tx begin`)

		this.con.exec('BEGIN IMMEDIATE')
		this.inTx = true
		
		try{
			var ret = func()

			if(ret instanceof Promise){
				ret
					.then(ret => {
						log.debug(`sql tx commit`)
						this.con.exec('COMMIT')
					})
					.catch(error => {
						throw error
					})
			}else{
				log.debug(`sql tx commit`)
				this.con.exec('COMMIT')
			}
		}catch(error){
			log.debug(`sql tx begin`)
			this.con.exec('ROLLBACK')

			throw error
		}finally{
			this.inTx = false
		}

		return ret
	}

	async criticalTx(func){
		while(true){
			try{
				return this.tx(func)
			}catch(e){
				if(e.code !== 'SQLITE_BUSY' && e.code !== 'SQLITE_BUSY_SNAPSHOT'){
					throw e
				}

				log.info(`sql busy`)
				await wait(3000)
			}
		}
	}

	async monitorWAL(interval, maxSize){
		log.info(`monitoring WAL file`)

		while(true){
			await wait(interval)

			try{
				let stat = fs.statSync(`${this.file}-wal`)

				log.debug(`WAL file is`, parseInt(stat.size), `bytes`)

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

				log.debug(`${this.fileName} query (${timeInMs}ms): ${formatted}`)

				return res
			}
		}
	}
}