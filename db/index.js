import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { open } from '@structdb/sqlite'
import codecs from './codecs/index.js'


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const schemas = {}

for(let file of fs.readdirSync(path.join(__dirname, 'schemas'))){
	let { name, ext } = path.parse(file)

	if(ext === '.json')
		schemas[name] = JSON.parse(
			fs.readFileSync(
				path.join(__dirname, 'schemas', file)
			)
		)
}


export async function openLedger({ config, variant }){
	return await open({
		file: `${config.data.dir}/ledger-${variant}.db`,
		schema: schemas.snapshot,
		journalMode: 'WAL',
		codecs
	})
}

export async function cloneLedger({ config, ledger, newVariant }){
	await ledger.compact()
	fs.copyFileSync(ledger.file, `${config.data.dir}/ledger-${newVariant}.db`)
}

export async function openMeta({ config }){
	return await open({
		file: `${config.data.dir}/meta.db`,
		schema: schemas.meta,
		journalMode: 'WAL',
		codecs
	})
}