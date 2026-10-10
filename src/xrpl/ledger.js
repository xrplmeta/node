import { rippleToUnix } from '@xrplkit/time'

export async function fetch({ ctx, sequence }){
	let { result } = await ctx.xrpl.request({ 
		command: 'ledger', 
		ledger_index: sequence,
		transactions: true,
		expand: true
	})

	return format(result.ledger)
}

export function format(ledger){
	return {
		sequence: parseInt(ledger.ledger_index),
		hash: ledger.ledger_hash,
		closeTime: rippleToUnix(ledger.close_time || ledger.ledger_time),
		transactions: formatTransactions(ledger.transactions)
	}
}

export function formatTransactions(transactions){
	return transactions
		.map(
			tx => tx.tx_json
				? { ...tx.tx_json, hash: tx.hash, metaData: tx.meta }
				: tx
		)
		.map(annotateBatch)
		.sort(byTransactionIndex)
}

export const tfInnerBatchTxn = 0x40000000

/**
 * Inner transactions of a Batch are committed to the ledger as regular
 * transactions with their own hash and metadata. They are linked back to
 * their outer Batch transaction via `ParentBatchID` in the metadata.
 * This exposes that link as `parentBatchHash` for downstream consumers.
 */
export function annotateBatch(tx){
	let parentBatchHash = (tx.metaData || tx.meta)?.ParentBatchID

	if(!parentBatchHash)
		return tx

	return { ...tx, parentBatchHash }
}

export function isInnerBatchTransaction(tx){
	return Boolean(tx.parentBatchHash) || Boolean(tx.Flags & tfInnerBatchTxn)
}

function byTransactionIndex(a, b){
	let ia = (a.metaData || a.meta)?.TransactionIndex
	let ib = (b.metaData || b.meta)?.TransactionIndex

	if(ia === undefined || ib === undefined)
		return 0

	return ia - ib
}