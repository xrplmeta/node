export async function storeBalance({ meta, token, ledgerIndex, account, balance }){
	if(await getWhaleBalance({ meta, token, ledgerIndex, account }) === balance)
		return

	await meta.tokenWhaleBalances.createOne({
		data: {
			whale: {
				token,
				account: { address: account.address }
			},
			ledgerIndex,
			value: balance,
		}
	})
}

export async function getBalance({ meta, token, ledgerIndex, account }){
	let entry = await meta.tokenWhaleBalances.readOne({
		where: {
			whale: {
				token,
				account: { address: account.address }
			},
			ledgerIndex: {
				lessThanOrEqual: ledgerIndex
			}
		},
		orderBy: {
			ledgerIndex: 'desc'
		},
		take: 1
	})

	if(entry)
		return entry.value
}