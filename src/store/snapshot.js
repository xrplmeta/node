import fs from 'fs'
import { open as openDatabase } from '@structdb/sqlite'
import schemas from './schemas/index.js'
import codecs from './codecs/index.js'


export async function open({ config, variant }){
	let file = getFilePath({ config, variant })

	if(!file && variant !== 'live'){
		fs.copyFileSync(
			getFilePath({ config, variant: 'live' }), 
			file
		)
	}

	return await openDatabase({
		file,
		schema: schemas.snapshot,
		journalMode: 'WAL',
		codecs
	})
}

function getFilePath({ config, variant }){
	return `${config.data.dir}/snapshot-${variant}.db`
}