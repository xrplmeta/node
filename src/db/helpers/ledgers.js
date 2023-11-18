export function getAvailableRange({ ctx }){
	let start = ctx.db.core.ledgers.readOne({
		orderBy: {
			sequence: 'asc'
		}
	})

	let end = ctx.db.core.ledgers.readOne({
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


export function readMostRecentLedger({ ctx }){
	return ctx.db.core.ledgers.readOne({
		orderBy: {
			sequence: 'desc'
		}
	})
}


export function readLedgerAt({ ctx, sequence, time, clamp, include }){
	let key = sequence !== undefined
		? 'sequence'
		: 'closeTime'

	let point = sequence !== undefined
		? sequence
		: time

	let ledger = ctx.db.core.ledgers.readOne({
		where: {
			[key]: {
				lessOrEqual: point
			}
		},
		orderBy: {
			[key]: 'desc'
		},
		include
	})

	if(!ledger && clamp){
		ledger = ctx.db.core.ledgers.readOne({
			where: {
				[key]: {
					greaterThan: point
				}
			},
			orderBy: {
				[key]: 'asc'
			},
			include
		})
	}

	return ledger
}
