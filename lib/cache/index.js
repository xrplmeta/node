import DB from '../db.js'
import * as heads from './heads.js'
import * as tokens from './tokens.js'
import * as candles from './candles.js'
import * as trades from './trades.js'
import * as stats from './stats.js'

export default config => new DB({
	...config,
	file: `${config.data.dir}/cache.db`,
	journalMode: config.data.journalMode || 'WAL',
	modules: {
		heads,
		tokens,
		candles,
		trades,
		stats
	}
})
