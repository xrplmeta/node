import { eq } from "@xrplkit/xfl"

export function write({ meta, ledgerIndex, offer }){
	let previous = read({ meta, ledgerIndex, directory: offer.directory })

	if(previous){
		if(previous.ledgerIndex < ledgerIndex){
			if(eq(previous.volume, offer.volume))
				return

			meta.tokenOffers.update({
				data: {
					expirationLedgerIndex: ledgerIndex
				},
				where: {
					id: previous.id
				}
			})
		}
	}

	meta.tokenOffers.createOne({
		data: {
			...offer,
			ledgerIndex
		}
	})
}

export function read({ meta, ledgerIndex, directory }){
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