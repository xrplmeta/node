import { updateCacheForTokenMetrics } from './cache.js'
import { readPoint, writePoint } from './common.js'


const metricTables = {
	trustlines: 'tokenTrustlines',
	holders: 'tokenHolders',
	supply: 'tokenSupply',
	marketcap: 'tokenMarketcap'
}


export function writeTokenMetrics({ ctx, token, ledgerSequence, metrics }){
	for(let [key, value] of Object.entries(metrics)){
		writePoint({
			table: ctx.db[metricTables[key]],
			selector: {
				token
			},
			ledgerSequence,
			backwards: ctx.backwards,
			data: value.toString() !== '0'
				? { value }
				: null
		})
	}

	updateCacheForTokenMetrics({ ctx, token, metrics })
}


export function readTokenMetrics({ ctx, token, ledgerSequence, metrics }){
	let point = {}

	for(let key of Object.keys(metrics)){
		let entry = readPoint({
			table: ctx.db[metricTables[key]],
			selector: {
				token
			},
			ledgerSequence
		})

		if(entry){
			point[key] = entry.value
		}
	}

	return point
}



export function readTokenMetricSeries({ ctx, token, metric, sequenceStart, sequenceEnd }){
	return ctx.db[metricTables[metric]].readMany({
		where: {
			token,
			sequenceStart: {
				greaterOrEqual: sequenceStart
			},
			...(
				sequenceEnd
					? {
						sequenceEnd: {
							lessOrEqual: sequenceEnd
						}
					}
					: {}
			)
		}
	})
}



export function readTokenMetricIntervalSeries({ ctx, token, metric, sequence, time }){
	let table = metricTables[metric]
	
	if(time){
		return ctx.db[table].readManyRaw({
			query: 
				`SELECT MAX(Ledger.closeTime) as time, value
				FROM ${table}
				LEFT JOIN Ledger ON (Ledger.sequence = ledgerSequence)
				WHERE token = ?
					AND (
						(Ledger.closeTime >= ? AND Ledger.closeTime <= ?)
						OR
						(
							ledgerSequence = (
								SELECT ledgerSequence
								FROM ${table}
								WHERE token = ?
									AND ledgerSequence < ?
								ORDER BY ledgerSequence DESC
								LIMIT 1
							)
						)
					)
				GROUP BY Ledger.closeTime / CAST(? as INTEGER)
				ORDER BY Ledger.closeTime ASC`,
			params: [
				token.id,
				time.start,
				time.end,
				token.id,
				sequence.start,
				time.interval,
			]
		})
	}else{
		return ctx.db[table].readManyRaw({
			query: 
				`SELECT MAX(ledgerSequence) as sequence, value
				FROM ${table}
				WHERE token = ?
					AND (
						(ledgerSequence >= ? AND ledgerSequence <= ?)
						OR
						(
							ledgerSequence = (
								SELECT ledgerSequence
								FROM ${table}
								WHERE token = ?
									AND ledgerSequence < ?
								ORDER BY ledgerSequence DESC
								LIMIT 1
							)
						)
					)
				GROUP BY ledgerSequence / CAST(? as INTEGER)
				ORDER BY ledgerSequence ASC`,
			params: [
				token.id,
				sequence.start,
				sequence.end,
				token.id,
				sequence.start,
				sequence.interval,
			]
		})
	}
}