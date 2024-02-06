import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import createStructDB from '@structdb/sqlite'
import codecs from './codecs/index.js'


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)


export async function openDB({ ctx, inMemory=false }){
	let db = await createStructDB({
		file: inMemory
			? ':memory:'
			: `${ctx.config.node.dataDir}/database.db`,
		schema: JSON.parse(
			fs.readFileSync(
				path.join(__dirname, 'schema.json')
			)
		),
		journalMode: 'WAL',
		timeout: 600000,
		debug: ctx.config.debug?.queries,
		codecs
	})

	db.loadExtension(
		path.join(
			__dirname, 
			'..', 
			'..', 
			'deps', 
			'sqlite-extensions', 
			'xfl.so',
		)
	)

	db.tokens.createOne({
		data: {
			currency: 'XRP',
			issuer: null
		}
	})

	return db
}