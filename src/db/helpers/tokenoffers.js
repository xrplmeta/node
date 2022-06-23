import { writePoint, clearPoint } from '../../lib/datapoints.js'


export function writeTokenOffer({ ctx, account, accountSequence, ledgerSequence, book, quality, size, sizeFunded }){
	return writePoint({
		table: ctx.db.tokenOffers,
		selector: {
			account,
			accountSequence,
			book,
		},
		ledgerSequence,
		data: {
			quality,
			size,
			sizeFunded
		},
		expirable: true
	})
}

export function expireTokenOffer({ ctx, account, accountSequence, ledgerSequence }){
	return clearPoint({
		table: ctx.db.tokenOffers,
		selector: {
			account,
			accountSequence
		},
		ledgerSequence,
		expirable: true
	})
}