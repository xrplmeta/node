import { alignTokenExchange } from '../../db/helpers/tokenexchanges.js'


export function compose(functions){
	return args => functions.reduce(
		(v, f) => f(v),
		args	
	)
}

export function getAvailableRange({ ctx }){
	let start = ctx.db.ledgers.readOne({
		orderBy: {
			sequence: 'asc'
		}
	})

	let end = ctx.db.ledgers.readOne({
		orderBy: {
			sequence: 'desc'
		}
	})

	return {
		sequence: {
			start: start.sequence,
			end: end.sequence
		},
		time: {
			start: start.closeTime,
			end: end.closeTime
		}
	}
}


export function readTokenMetricSeries({ ctx, table, token, range, interval }){
	return ctx.db[table].readMany({
		where: {
			RAW: {
				text: `token = ? AND (
					ledgerSequence IN (
						SELECT MAX(ledgerSequence)
						FROM ${table}
						WHERE token = ?
						AND ledgerSequence >= ?
						AND ledgerSequence <= ?
						GROUP BY ledgerSequence / CAST(? as INTEGER)
					)
					OR 
					ledgerSequence = (
						SELECT MAX(ledgerSequence)
						FROM ${table}
						WHERE token = ?
						AND ledgerSequence < ?
					)
				)`,
				values: [
					token.id,
					token.id,
					range.start,
					range.end,
					interval,
					token.id,
					range.start
				]
			}
		},
		orderBy: {
			ledgerSequence: 'asc'
		}
	})
}


export function readTokenPriceSeries({ ctx, base, quote, range, interval }){
	return ctx.db.tokenExchanges.readMany({
		where: {
			RAW: {
				text: `(
					(takerPaidToken = ? AND takerGotToken = ?)
					OR
					(takerGotToken = ? AND takerPaidToken = ?)
				) 
				AND (
					ledgerSequence IN (
						SELECT MAX(ledgerSequence)
						FROM TokenExchange
						WHERE (
							(takerPaidToken = ? AND takerGotToken = ?)
							OR
							(takerGotToken = ? AND takerPaidToken = ?)
						)
						AND ledgerSequence >= ?
						AND ledgerSequence <= ?
						GROUP BY ledgerSequence / CAST(? as INTEGER)
					)
					OR 
					ledgerSequence = (
						SELECT MAX(ledgerSequence)
						FROM TokenExchange
						WHERE (
							(takerPaidToken = ? AND takerGotToken = ?)
							OR
							(takerGotToken = ? AND takerPaidToken = ?)
						)
						AND ledgerSequence < ?
					)
				)`,
				values: [
					base.id,
					quote.id,
					quote.id,
					base.id,
					base.id,
					quote.id,
					quote.id,
					base.id,
					range.start,
					range.end,
					interval,
					base.id,
					quote.id,
					quote.id,
					base.id,
					range.start
				]
			}
		},
		orderBy: {
			ledgerSequence: 'asc'
		}
	})
		.map(exchange => alignTokenExchange({ exchange, base, quote }))
}



export function findLedgerAt({ ctx, time }){
	return ctx.db.ledgers.readOne({
		where: {
			closeTime: {
				lessOrEqual: time
			}
		},
		orderBy: {
			sequence: 'desc'
		}
	})
}

export function collapseMetas(metas, sourcePriority){
	let collapsed = {}

	for(let [key, values] of Object.entries(metas)){
		if(!values)
			continue

		if(Array.isArray(values)){
			let meta = values[0]

			if(meta.value)
				collapsed[key] = meta.value
		}else{
			collapsed[key] = collapseMetas(values, sourcePriority)
		}
	}

	return collapsed
}