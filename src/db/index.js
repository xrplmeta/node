import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import createStructDB from '@structdb/sqlite'
import codecs from './codecs/index.js'


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)


export async function openDB({ ctx, coreReadOnly=false, inMemory=false }){
	return {
		core: await openCoreDB({
			ctx,
			readOnly: coreReadOnly,
			inMemory
		}),
		cache: await openCacheDB({
			ctx,
			inMemory
		})
	}
}

export async function openCoreDB({ ctx, readOnly=false, inMemory=false }){
	let db = await createStructDB({
		file: inMemory
			? ':memory:'
			: `${ctx.config.node.dataDir}/core.db`,
		schema: JSON.parse(
			fs.readFileSync(
				path.join(__dirname, 'schemas/core.json')
			)
		),
		journalMode: 'WAL',
		timeout: 600000,
		debug: ctx.config.debug?.queries,
		codecs,
		readOnly
	})

	db.loadExtension(
		path.join(
			__dirname, 
			'..', 
			'..', 
			'deps', 
			'build', 
			'Release', 
			'sqlite-xfl.node'
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

export async function openCacheDB({ ctx, inMemory=false }){
	return await createStructDB({
		file: inMemory
			? ':memory:'
			: `${ctx.config.node.dataDir}/cache.db`,
		schema: JSON.parse(
			fs.readFileSync(
				path.join(__dirname, 'schemas/cache.json')
			)
		),
		journalMode: 'WAL',
		debug: ctx.config.debug?.queries,
		codecs
	})
}