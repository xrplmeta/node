import fs from 'fs'
import { open as openDatabase } from '@structdb/sqlite'
import schemas from './schemas/index.js'
import codecs from './codecs/index.js'


export function open({ ctx }){
	let meta = openDatabase({
		file: `${ctx.config.data.dir}/meta.db`,
		schema: schemas.meta,
		journalMode: 'WAL',
		codecs,
		debug: ctx.config.debug?.queries
	})

	meta.tokens.createOne({
		data: {
			currency: 'XRP'
		}
	})

	return meta
}