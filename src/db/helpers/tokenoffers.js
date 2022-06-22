import { writePoint, clearPoint } from '../../lib/datapoints.js'


export function writeTokenOffer({ ctx, account, accountSequence, ledgerSequence, book, quality, size, sizeFunded }){
	writePoint({
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
		}
	})
}

export function expireTokenOffer({ ctx, account, accountSequence, ledgerSequence }){
	clearPoint({
		table: ctx.db.tokenOffers,
		selector: {
			account,
			accountSequence,
			book
		},
		ledgerSequence
	})
}