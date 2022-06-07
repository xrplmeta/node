
export async function write({ meta, ledgerIndex, offer }){
	let previous = await read({ meta, ledgerIndex, directory: offer.directory })

	await meta.tokenOffers.createOne({
		data: {
			...offer,
			startLedgerIndex: ledgerIndex
		}
	})
}

export async function read({ meta, ledgerIndex, directory }){
	return meta.tokenOffers.readOne({
		where: {
			startLedgerIndex: {
				lessOrEqual: ledgerIndex
			},
			
		}
	})
}


/*
OR: [
	{
		endLedgerIndex: null
	},
	{
		endLedgerIndex: {
			greaterThan: ledgerIndex
		}
	}
]
*/