import DB from '../db.js'
import { apply as applyMigrations } from './migrations.js'
import * as modules from './modules.js'


export default config => {
	let db = new DB({
		journalMode: 'WAL',
		file: `${config.data?.dir}/repo.db`,
		...config
	})

	applyMigrations(db)

	db.registerModules(modules)

	return db
}