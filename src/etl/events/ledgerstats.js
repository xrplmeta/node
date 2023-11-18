import { div, max, min, sum, floor } from "@xrplkit/xfl"

const pseudoTransactionTypes = [
	'EnableAmendment',
	'SetFee',
	'UNLModify'
]


export function extractLedgerStats({ ctx, ledger }){
	let baseData = {
		sequence: ledger.sequence,
		hash: ledger.hash,
		closeTime: ledger.closeTime,
		txCount: ledger.transactions.length,
	}

	if(ledger.transactions.length === 0){
		ctx.db.core.ledgers.createOne({
			data: baseData
		})
	}else{
		let types = {}
		let fees = []

		for(let transaction of ledger.transactions){
			if(pseudoTransactionTypes.includes(transaction.TransactionType))
				continue

			if(!types[transaction.TransactionType])
				types[transaction.TransactionType] = 0
			
			types[transaction.TransactionType]++
			fees.push(parseInt(transaction.Fee))
		}

		ctx.db.core.ledgers.createOne({
			data: {
				...baseData,
				txTypeCounts: Object.entries(types)
					.map(([type, count]) => ({ type, count })),
				minFee: Math.min(...fees),
				maxFee: Math.max(...fees),
				avgFee: Math.floor(
					fees.reduce((total, fee) => total + fee, 0) / fees.length
				)
			}
		})
	}
}