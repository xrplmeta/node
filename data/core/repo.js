import path from 'path'
import Database from './db.js'
import EventEmitter from '../../common/events.js'
import * as submodules from './repo/index.js'
import { wait, unixNow } from '../../common/time.js'
import { log } from '../lib/logging.js'


export default class Repo extends EventEmitter{
	constructor(config){
		super()

		this.config = config
		this.log = log.for('repo', 'yellow')

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
		
		this.structure.ensure()

		this.log(`opened database: ${file}`)
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