import { isInnerBatchTransaction } from '../../xrpl/ledger.js'

const pseudoTransactionTypes = [
	'EnableAmendment',
	'SetFee',
	'UNLModify'
]


export function applyLedgerStats({ ctx, ledger }){
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

			// inner batch transactions carry Fee "0" - the actual cost
			// is already included in the outer Batch transaction's fee
			if(isInnerBatchTransaction(transaction))
				continue

			fees.push(parseInt(transaction.Fee))
		}

		let feeStats = fees.length > 0
			? {
				minFee: Math.min(...fees),
				maxFee: Math.max(...fees),
				avgFee: Math.floor(
					fees.reduce((total, fee) => total + fee, 0) / fees.length
				)
			}
			: {}

		ctx.db.core.ledgers.createOne({
			data: {
				...baseData,
				txTypeCounts: Object.entries(types)
					.map(([type, count]) => ({ type, count })),
				...feeStats
			}
		})
	}
}