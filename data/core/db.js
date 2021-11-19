import Adapter from 'better-sqlite3'
import { wait } from '../../common/time.js'

export default class{
	constructor(config){
		this.cfg = config
		this.con = new Adapter(config.file)
	}

	pragma(sql){
		return this.con.pragma(sql)
	}

	exec(sql){
		return this.con.exec(sql)
	}

	prepare(sql){
		return this.con.prepare(sql)
	}

	get(sql, ...params){
		return this.prepare(sql).get(...params)
	}

	getv(sql, ...params){
		let res = this.prepare(sql).get(...params)
		return res[Object.keys(res)[0]]
	}

	all(sql, ...params){
		return this.prepare(sql).all(...params)
	}

	allv(sql, ...params){
		let rows = this.prepare(sql).all(...params)
			
		if(rows.length === 0)
			return []

		let key = Object.keys(rows[0])[0]

		return rows.map(row => row[key])
	}

	async run(sql, ...params){
		while(true){
			try{
				return this.prepare(sql).run(...params)
			}catch(e){
				if(e.code !== 'SQLITE_BUSY' && e.code !== 'SQLITE_BUSY_SNAPSHOT'){
					throw e
				}

				await wait(100)
			}
		}
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
							await this.run(
								`DELETE FROM ${table}
								WHERE ${compare.join(` AND `)}`,
								data
							)
						}else{
							return
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
		this.con.exec('BEGIN')

		try{
			var ret = await func()
			this.con.exec('COMMIT')
		}catch(error){
			this.con.exec('ROLLBACK')
			throw error
		}

		return ret
	}
}