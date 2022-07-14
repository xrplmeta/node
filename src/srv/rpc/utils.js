import { alignTokenExchange } from '../../db/helpers/tokenexchanges.js'
import { div } from '@xrplkit/xfl'


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



export function readTokenMetricSeries({ ctx, table, token, sequence, time }){
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

export function readTokenExchangeSeries({ ctx, base, quote, sequence, time }){
	if(time){
		var exchanges = ctx.db.tokenExchanges.readManyRaw({
			query: 
				`SELECT MAX(Ledger.closeTime) as time, takerPaidToken, takerGotToken, takerPaidValue, takerGotValue
				FROM TokenExchange
				LEFT JOIN Ledger ON (Ledger.sequence = ledgerSequence)
				WHERE (
						(takerPaidToken = ? AND takerGotToken = ?)
						OR
						(takerGotToken = ? AND takerPaidToken = ?)
					)
					AND 
					(
						(Ledger.closeTime >= ? AND Ledger.closeTime <= ?)
						OR
						(
							ledgerSequence = (
								SELECT ledgerSequence
								FROM TokenExchange
								WHERE (
										(takerPaidToken = ? AND takerGotToken = ?)
										OR
										(takerGotToken = ? AND takerPaidToken = ?)
									)
									AND ledgerSequence < ?
								ORDER BY ledgerSequence DESC
								LIMIT 1
							)
						)
					)
				GROUP BY Ledger.closeTime / CAST(? as INTEGER)
				ORDER BY Ledger.closeTime ASC`,
			params: [
				base.id,
				quote.id,
				quote.id,
				base.id,
				time.start,
				time.end,
				base.id,
				quote.id,
				quote.id,
				base.id,
				sequence.start,
				time.interval,
			]
		})
	}else{
		var exchanges = ctx.db.tokenExchanges.readManyRaw({
			query: 
				`SELECT MAX(ledgerSequence) as sequence, takerPaidToken, takerGotToken, takerPaidValue, takerGotValue
				FROM TokenExchange
				WHERE (
						(takerPaidToken = ? AND takerGotToken = ?)
						OR
						(takerGotToken = ? AND takerPaidToken = ?)
					)
					AND (
						(ledgerSequence >= ? AND ledgerSequence <= ?)
						OR
						(
							ledgerSequence = (
								SELECT ledgerSequence
								FROM TokenExchange
								WHERE (
										(takerPaidToken = ? AND takerGotToken = ?)
										OR
										(takerGotToken = ? AND takerPaidToken = ?)
									)
									AND ledgerSequence < ?
								ORDER BY ledgerSequence DESC
								LIMIT 1
							)
						)
					)
				GROUP BY ledgerSequence / CAST(? as INTEGER)
				ORDER BY ledgerSequence ASC`,
			params: [
				base.id,
				quote.id,
				quote.id,
				base.id,
				sequence.start,
				sequence.end,
				base.id,
				quote.id,
				quote.id,
				base.id,
				sequence.start,
				sequence.interval,
			]
		})
	}

	return exchanges.map(
		({ takerPaidToken, takerGotToken, takerPaidValue, takerGotValue, ...props }) => {
			if(takerPaidToken === base.id){
				return {
					...props,
					price: div(takerGotValue, takerPaidValue),
					volume: takerPaidValue
				}
			}else{
				return {
					...props,
					price: div(takerPaidValue, takerGotValue),
					volume: takerGotValue
				}
			}
		}
	)
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