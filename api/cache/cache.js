import DB from '@xrplmeta/db'
import * as heads from './heads.js'
import * as tokens from './tokens.js'
import * as candles from './candles.js'
import * as trades from './trades.js'
import * as stats from './stats.js'
import * as updates from './updates.js'


export default config => new DB({
	...config,
	file: config.cache.inMemory
		? ':memory:'
		: `${config.data.dir}/${config.cache.dbName || 'cache'}.db`,
	journalMode: 'MEMORY',
	modules: {
		heads,
		tokens,
		candles,
		trades,
		stats,
		updates
	}
})
