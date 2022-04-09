import DB from '../db.js'
import * as heads from './heads.js'
import * as tokens from './tokens.js'
import * as candles from './candles.js'
import * as trades from './trades.js'
import * as stats from './stats.js'


export default config => {
	let db = new DB({
		...config,
		file: `${config.data.dir}/cache.db`,
		journalMode: config.data.journalMode || 'WAL'
	})

	db.registerModules({
		heads,
		tokens,
		candles,
		trades,
		stats
	})
	
	return db
}