export function all(token, start, end){
	let table = deriveTable(token)

	return this.all(
		`SELECT * FROM ${table}
		WHERE date >=? AND date <= ?`,
		start,
		end
	)
}

export function set(token, stats){
	if(stats.length === 0)
		return

	let table = deriveTable(token)
	let cols = Object.keys(stats[0])
	let percentCols = cols.filter(col => col.startsWith('percent'))

	ensureTable.call(this, table, percentCols)

	this.insert({
		table,
		data: stats
	})
}

export function insert(token, stat){
	let table = deriveTable(token)

	this.insert({
		table,
		data: stat
	})
}

export function vacuum(token, ids){
	let table = deriveTable(token)
	let existing = this.all(`SELECT id FROM ${table}`)
	let missing = ids.filter(id => !existing.includes(id))
	let excess = existing.filter(id => !ids.includes(id))

	for(let id of excess){
		this.run(
			`DELETE FROM ${table}
			WHERE id = ?`,
			id
		)
	}

	return missing
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
			"id"			INTEGER NOT NULL UNIQUE,
			"ledger"		INTEGER NOT NULL,
			"date"			INTEGER NOT NULL,
			"trustlines"	INTEGER NOT NULL,
			"supply"		TEXT NOT NULL,
			"marketcap"		TEXT NOT NULL,
			"bid"			TEXT NOT NULL,
			"ask"			TEXT NOT NULL,
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

function deriveTable(token){
	return `Stats${token.id}`
}