import DB from '@xrplmeta/common/lib/db.js'
import * as modules from './cache/index.js'


export default config => new DB({
	...config,
	file: config.cache.inMemory
		? ':memory:'
		: `${config.data.dir}/${config.cache.dbName || 'cache'}.db`,
	modules, 
	journalMode: 'MEMORY'
})
