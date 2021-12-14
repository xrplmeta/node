import fs from 'fs'
import DB from '@xrplmeta/common/lib/db.js'
import { log } from '@xrplmeta/common/lib/log.js'
import * as modules from './snapshot/index.js'


export default (file, inMemory) => {
	if(file !== ':memory:')
		if(fs.existsSync(file))
			fs.unlinkSync(file)

	return new DB({
		file, 
		modules, 
		journalMode: 'MEMORY',
		cacheSize: 10000
	})
}