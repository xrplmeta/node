import Adapter from 'better-sqlite3'
import { wait } from '../lib/time.js'
import { log } from '../lib/log.js'

export default class{
	constructor(config){
		this.cfg = config
		this.con = new Adapter(config.file)
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
		return this.con.prepare(sql)
	}

	get(sql, ...params){
		log.debug(`sql get: ${sql}`, params)
		return this.prepare(sql).get(...params)
	}

	getv(sql, ...params){
		log.debug(`sql getv: ${sql}`, params)
		let res = this.prepare(sql).get(...params)
		return res[Object.keys(res)[0]]
	}

	all(sql, ...params){
		log.debug(`sql all: ${sql}`, params)
		return this.prepare(sql).all(...params)
	}

	allv(sql, ...params){
		log.debug(`sql allv: ${sql}`, params)
		let rows = this.prepare(sql).all(...params)
			
		if(rows.length === 0)
			return []

		let key = Object.keys(rows[0])[0]

		return rows.map(row => row[key])
	}

	run(sql, ...params){
		log.debug(`sql run: ${sql}`, params)
		return this.prepare(sql).run(...params)
	}

	async insert(table, data, options){
		if(Array.isArray(data)){
			return await this.tx(async () => {
				let rows = []

				for(let item of data){
					rows.push(await this.insert(table, item, options))
				}

				return rows
			})
		}else{
			if(options?.duplicate){
				let duplicateKeys = options.duplicate.keys || Object.keys(data)
				let compare = duplicateKeys.map(key => `\`${key}\`=@${key}`)

				let existing = this.get(
					`SELECT * FROM ${table}
					WHERE ${compare.join(` AND `)}`,
					data
				)


				if(existing){
					if(options.duplicate.ignore)
						return existing

					if(options.duplicate.update){
						let updates = Object.keys(data)
							.filter(key => !duplicateKeys.includes(key))
							.map(key => `\`${key}\`=@${key}`)

						this.run(
							`UPDATE ${table} 
							SET ${updates} 
							WHERE ${compare.join(` AND `)}`,
							data
						)

						return {...existing, ...data}
					}else if(options.duplicate.replace){
						if(Object.entries(data).some(([k, v]) => existing[k] !== v)){
							this.run(
								`DELETE FROM ${table}
								WHERE ${compare.join(` AND `)}`,
								data
							)
						}else{
							return existing
						}
					}
				}
			}

			let info = this.run(
				`INSERT INTO ${table}
				(${Object.keys(data).map(key => `\`${key}\``).join(',')})
				VALUES
				(${Object.keys(data).map(key => `@${key}`).join(',')})`,
				data
			)

			return this.get(
				`SELECT * FROM ${table} 
				WHERE rowid = ?`, 
				info.lastInsertRowid
			)
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
}