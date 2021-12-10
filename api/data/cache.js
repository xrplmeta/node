import DB from '@xrplmeta/common/lib/db.js'
import * as modules from './scandb/index.js'


export default config => new DB({
	file: config.cache.inMemory
		? ':memory:'
		: `${config.data.dir}/cache.db`,
	modules, 
	journalMode: 'MEMORY',
	cacheSize: 10000
})
