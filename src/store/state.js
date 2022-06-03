import fs from 'fs'
import { open as openDatabase } from '@structdb/sqlite'
import schemas from './schemas/index.js'
import codecs from './codecs/index.js'


export async function open({ config, variant }){
	let file = getFilePath({ config, variant })

	if(!file && variant !== 'current'){
		fs.copyFileSync(
			getFilePath({ config, variant: 'current' }), 
			file
		)
	}

	return await openDatabase({
		file,
		schema: schemas.state,
		journalMode: 'WAL',
		codecs
	})
}

function getFilePath({ config, variant }){
	return `${config.data.dir}/state.${variant}.db`
}