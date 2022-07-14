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
			sequence: 'desc'
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
				sequence: 'asc'
			}
		})
	}

	return ledger
}
