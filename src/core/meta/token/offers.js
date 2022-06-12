import { eq } from "@xrplkit/xfl"

export function write({ ctx, base, quote, ledgerIndex, offers }){
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

export function read({ ctx, base, quote, ledgerIndex, limit = 9999999 }){
	return ctx.meta.tokenOffers.readMany({
		where: {
			base,
			quote,
			ledgerIndex: {
				lessOrEqual: ledgerIndex
			},
			OR: [
				{
					expirationLedgerIndex: null
				},
				{
					expirationLedgerIndex: {
						greaterThan: ledgerIndex
					}
				}
			]
		},
		orderBy: {
			rank: 'asc'
		},
		take: limit
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