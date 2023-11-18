import { writePoint } from './common.js'


export function writeNFTokenOffer({ ctx, offerId, ledgerSequence, ...data }){
	return writePoint({
		table: ctx.db.core.nftOffers,
		selector: {
			offerId,
		},
		ledgerSequence,
		backwards: ctx.backwards,
		data,
		expirable: true
	})
}

export function expireNFTokenOffer({ ctx, offerId, ledgerSequence }){
	return writePoint({
		table: ctx.db.core.nftOffers,
		selector: {
			offerId,
		},
		ledgerSequence,
		backwards: ctx.backwards,
		data: null,
		expirable: true
	})
}