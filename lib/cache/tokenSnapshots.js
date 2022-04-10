export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "TokenSnapshots" (
			"id"			INTEGER NOT NULL UNIQUE,
			"token"			INTEGER NOT NULL,
			"timeframe"		INTEGER NOT NULL,
			"head"			INTEGER NOT NULL,
			"tail"			INTEGER NOT NULL,
			"ledger"		INTEGER NOT NULL,
			"date"			INTEGER NOT NULL,
			"trustlines"	INTEGER NOT NULL,
			"holders"		INTEGER NOT NULL,
			"supply"		TEXT NOT NULL,
			"marketcap"		TEXT NOT NULL,
			"bid"			TEXT NOT NULL,
			"ask"			TEXT NOT NULL,
			${
				this.config.xrpl.topPercenters
					.map(p => `"percent${p.toString().replace('.', '')}"	REAL`)
					.join(', ')
			},
			PRIMARY KEY ("id" AUTOINCREMENT),
			UNIQUE("token", "timeframe", "ledger")
		);

		CREATE INDEX IF NOT EXISTS
		"TokenSnapshotsDate" ON "TokenSnapshots"
		("date");`
	)
}


export function all(series, start, end){
	return this.all(
		`SELECT * FROM "TokenSnapshots"
		WHERE token = @token
		AND timeframe = @timeframe
		AND date >= @start 
		AND date <= @end`,
		{
			...series,
			start,
			end
		}
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
	let timeframe = series.timeframe
	let points = []

	for(let stat of stats){
		let t = Math.floor(stat.date / timeframe) * timeframe
		let point = {
			...stat,
			...series,
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

	this.insert({
		table: 'TokenSnapshots',
		data: points
	})
}


export function integrate(series, stats){
	let timeframe = series.timeframe
	let t = Math.floor(stats.date / timeframe) * timeframe
	let point = this.get(
		`SELECT * FROM "TokenSnapshots"
		WHERE token = @token
		AND timeframe = @timeframe
		AND date = @t`,
		{
			...series,
			t
		}
	)

	if(point){
		if(stats.ledger > point.head){
			point.head = stats.ledger
			Object.assign(point, stats, {date: t})
		}
	}else{
		point = {
			...stats,
			...series,
			date: t,
			head: stats.ledger,
			tail: stats.ledger
		}
	}

	let { id, ...override } = point

	this.insert({
		table: 'TokenSnapshots',
		data: override,
		duplicate: 'update'
	})
}