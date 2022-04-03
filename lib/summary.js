export function fromTxs(txs){
	let pays = 0
	let trusts = 0
	let untrusts = 0
	let offers = 0
	let cancels = 0
	let fees = 0
	let accounts = new Set()

	for(let tx of txs){
		let result = tx.engine_result 
			|| tx.meta?.TransactionResult 
			|| tx.metaData?.TransactionResult

		if(result !== 'tesSUCCESS')
			continue

		if(tx.transaction)
			tx = tx.transaction

		accounts.add(tx.Account)
		fees += parseInt(tx.Fee)

		switch(tx.TransactionType){
			case 'Payment':
				pays++
				break

			case 'OfferCreate':
				offers++
				break

			case 'OfferCancel':
				cancels++
				break

			case 'TrustSet':
				if(tx.LimitAmount.value !== '0')
					trusts++
				else
					untrusts++
				break
		}
	}

	return {
		txs: txs.length,
		pays,
		trusts,
		untrusts,
		offers,
		cancels,
		fees,
		accounts: accounts.size
	}
}