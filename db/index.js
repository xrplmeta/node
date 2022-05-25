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


export function openLedger({ config, variant }){
	return open({
		file: `${config.data.dir}/ledger-${variant}.db`,
		schema: schemas.snapshot,
		journalMode: 'WAL',
		codecs
	})
}

export function cloneLedger({ config, ledger, newVariant }){
	ledger.compact()
	fs.copyFileSync(ledger.file, `${config.data.dir}/ledger-${newVariant}.db`)
}

export function openMeta({ config }){
	return open({
		file: `${config.data.dir}/meta.db`,
		schema: schemas.meta,
		journalMode: 'WAL',
		codecs
	})
}