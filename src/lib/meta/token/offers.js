import { eq } from "@xrplkit/xfl"

export async function write({ meta, ledgerIndex, offer }){
	let previous = await read({ meta, ledgerIndex, directory: offer.directory })

	if(previous){
		if(previous.ledgerIndex < ledgerIndex){
			if(eq(previous.volume, offer.volume))
				return

			await meta.tokenOffers.update({
				data: {
					expirationLedgerIndex: ledgerIndex
				},
				where: {
					id: previous.id
				}
			})
		}
	}

	await meta.tokenOffers.createOne({
		data: {
			...offer,
			ledgerIndex
		}
	})
}

export async function read({ meta, ledgerIndex, directory }){
	return meta.tokenOffers.readOne({
		where: {
			directory,
			startLedgerIndex: {
				lessOrEqual: ledgerIndex
			}
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