import DB from '../db.js'
import * as heads from './heads.js'
import * as tokens from './tokens.js'
import * as tokenCandles from './tokenCandles.js'
import * as tokenTrades from './tokenTrades.js'
import * as tokenSnapshots from './tokenSnapshots.js'


export default config => {
	let db = new DB({
		...config,
		file: `${config.data.dir}/cache.db`,
		journalMode: config.data.journalMode || 'WAL'
	})

	db.registerModules({
		heads,
		tokens,
		tokenCandles,
		tokenTrades,
		tokenSnapshots
	})
	
	return db
}