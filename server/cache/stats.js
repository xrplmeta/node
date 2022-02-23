export function all(series, start, end){
	let table = deriveTable(series)

	return this.all(
		`SELECT * FROM ${table}
		WHERE date >=? AND date <= ?`,
		start,
		end
	)
		.map(({id, bid, ask, ...row}) => {
			let distribution = {}

			for(let key in row){
				if(key.startsWith('percent')){
					let cleanKey = key
						.slice(7)
						.replace(/^0/, '0.')

					distribution[cleanKey] = row[key]
					delete row[key]
				}
			}

			return {
				...row,
				liquidity: {bid, ask},
				distribution
			}
		})
}

export function allocate(series, stats){
	let table = deriveTable(series)
	let timeframe = series.timeframe
	let points = []

	for(let stat of stats){
		let t = Math.floor(stat.date / timeframe) * timeframe
		let point = {
			...stat,
			date: t,
			head: stat.ledger,
			tail: stat.ledger
		}
		let lastPoint = points[points.length - 1]

		if(lastPoint?.date === t){
			Object.assign(lastPoint, point)
			
			point.head = Math.max(point.head, stat.ledger)
			point.tail = Math.min(point.tail, stat.ledger)
		}else{
			points.push(point)
		}
	}

	if(points.length === 0)
		return

	ensureTable.call(this, table, points[0])

	this.insert({
		table,
		data: points
	})
}


export function integrate(series, stats){
	let table = deriveTable(series)
	let timeframe = series.timeframe
	let t = Math.floor(stats.date / timeframe) * timeframe

	ensureTable.call(this, table, stats)
	
	let point = this.get(`SELECT * FROM ${table} WHERE date = ?`, t)

	if(point){
		if(stats.ledger > point.head){
			point.head = stats.ledger
			Object.assign(point, stats, {date: t})
		}
	}else{
		point = {
			...stats,
			date: t,
			head: stats.ledger,
			tail: stats.ledger
		}
	}

	this.insert({
		table,
		data: point,
		duplicate: 'update'
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

function ensureTable(table, reference){
	if(doesTableExist.call(this, table))
		return

	this.exec(
		`CREATE TABLE "${table}" (
			"id"			INTEGER NOT NULL UNIQUE,
			"head"		INTEGER NOT NULL,
			"tail"		INTEGER NOT NULL,
			"ledger"		INTEGER NOT NULL,
			"date"			INTEGER NOT NULL,
			"trustlines"	INTEGER NOT NULL,
			"supply"		TEXT NOT NULL,
			"marketcap"		TEXT NOT NULL,
			"bid"			TEXT NOT NULL,
			"ask"			TEXT NOT NULL,
			${
				Object.keys(reference)
					.filter(col => col.startsWith('percent'))
					.map(col => `"${col}"	REAL`)
					.join(', ')
			}
		);

		CREATE UNIQUE INDEX IF NOT EXISTS
		"${table}Date" ON "${table}"
		("date");`
	)
}

function deriveTable({ token, timeframe }){
	return `Stats${token}T${timeframe}`
}