import fs from 'fs'
import { open as openDatabase } from '@structdb/sqlite'
import schemas from './schemas/index.js'
import codecs from './codecs/index.js'


export function open({ ctx }){
	return openDatabase({
		file: `${ctx.config.data.dir}/meta.db`,
		schema: schemas.meta,
		journalMode: 'WAL',
		codecs
	})
}