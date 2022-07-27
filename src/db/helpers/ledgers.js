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


export function readMostRecentLedger({ ctx }){
	return ctx.db.ledgers.readOne({
		orderBy: {
			sequence: 'desc'
		}
	})
}


export function readLedgerAt({ ctx, time, clamp }){
	let ledger = ctx.db.ledgers.readOne({
		where: {
			closeTime: {
				lessOrEqual: time
			}
		},
		orderBy: {
			closeTime: 'desc'
		}
	})

	if(!ledger && clamp){
		ledger = ctx.db.ledgers.readOne({
			where: {
				closeTime: {
					greaterThan: time
				}
			},
			orderBy: {
				closeTime: 'asc'
			}
		})
	}

	return ledger
}
