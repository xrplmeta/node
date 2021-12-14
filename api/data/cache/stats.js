import { keySort, mapMultiKey, nestDotNotated } from '@xrplmeta/common/lib/data.js'
import { createURI as createPairURI } from '@xrplmeta/common/lib/pair.js'
import { unixNow } from '@xrplmeta/common/lib/time.js'
import { log } from '@xrplmeta/common/lib/log.js'
import Decimal from '@xrplmeta/common/lib/decimal.js'



export function set(trustline, stats){
	if(stats.length === 0)
		return

	let table = deriveTable(trustline)
	let cols = Object.keys(stats[0])
	let percentCols = cols.filter(col => col.startsWith('percent'))

	ensureTable.call(this, table, percentCols)

	this.insert({
		table,
		data: stats
	})
}



function doesTableExist(table){
	return !!this.getv(
		`SELECT COUNT(1) 
		FROM sqlite_master 
		WHERE type='table' 
		AND name = ?`,
		table
	)
}

function ensureTable(table, percentCols){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "${table}" (
			"id"		INTEGER NOT NULL UNIQUE,
			"ledger"	INTEGER NOT NULL,
			"date"		INTEGER NOT NULL,
			"count"		INTEGER NOT NULL,
			"supply"	TEXT NOT NULL,
			"bid"		TEXT NOT NULL,
			"ask"		TEXT NOT NULL,
			${
				percentCols
					.map(col => `"${col}"	REAL`)
					.join(', ')
			}
		);

		CREATE UNIQUE INDEX IF NOT EXISTS
		"${table}Date" ON "${table}"
		("date");`
	)
}

function deriveTable(trustline){
	return `Stats${trustline.id}`
}