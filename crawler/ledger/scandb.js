import fs from 'fs'
import DB from '../../common/lib/db.js'
import { log } from '../../common/lib/log.js'
import * as modules from './scandb/index.js'


export default (file, inMemory) => {
	if(file !== ':memory:')
		if(fs.existsSync(file))
			fs.unlinkSync(file)

	return new DB({
		file, 
		modules, 
		journalMode: 'OFF',
		cacheSize: 10000
	})
}