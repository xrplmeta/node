import fs from 'fs'
import { open as openDatabase } from '@structdb/sqlite'
import schemas from '../schemas/index.js'


export function open({ config }){
	let db = openDatabase({
		file: `${config.data.dir}/meta.db`,
		schema: schemas.meta,
		journalMode: 'WAL'
	})

	return Object.assign(db, {
		
	})
}