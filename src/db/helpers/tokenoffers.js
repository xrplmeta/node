import { writePoint } from './common.js'


export function writeTokenOffer({ ctx, account, accountSequence, ledgerSequence, book, quality, size }){
	return writePoint({
		table: ctx.db.core.tokenOffers,
		selector: {
			account,
			accountSequence,
			book,
		},
		ledgerSequence,
		backwards: ctx.backwards,
		data: {
			quality,
			size
		},
		expirable: true
	})
}

export function expireTokenOffer({ ctx, account, accountSequence, ledgerSequence }){
	return writePoint({
		table: ctx.db.core.tokenOffers,
		selector: {
			account,
			accountSequence
		},
		ledgerSequence,
		backwards: ctx.backwards,
		data: null,
		expirable: true
	})
}

export function readOffersBy({ ctx, account, book, ledgerSequence }){
	return ctx.db.core.tokenOffers.readMany({
		where: {
			account,
			book,
			ledgerSequence: {
				lessOrEqual: ledgerSequence
			},
			lastLedgerSequence: {
				greaterOrEqual: ledgerSequence
			}
		},
		include: {
			book: true
		}
	})
}