import fs from 'fs'
import { open as openDatabase } from '@structdb/sqlite'
import schemas from './schemas/index.js'
import codecs from './codecs/index.js'


export async function open({ config }){
	return await openDatabase({
		file: `${config.data.dir}/meta.db`,
		schema: schemas.meta,
		journalMode: 'WAL',
		codecs
	})
}