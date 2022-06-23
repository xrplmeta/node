import { min } from '@xrplkit/xfl'
import { readBalance } from '../../../db/helpers/balances.js'
import { writeTokenOffer } from '../../../db/helpers/tokenoffers.js'


export function deriveOfferConstraintsByOffer({ ctx, offer }){
	let constrainedOffer = { ...offer }

	let balance = readBalance({
		ctx,
		account: offer.account,
		token: offer.book.takerGets,
		ledgerSequence: ctx.ledgerSequence
	})

	let ledger = ctx.db.ledgers.readOne({
		where: {
			sequence: ctx.ledgerSequence
		}
	})

	/*console.log({
		account: offer.account,
		token: offer.book.takerGets,
		ledgerSequence: ctx.ledgerSequence
	})
	console.log(balance, min(offer.size, balance || '0'))*/

	constrainedOffer.sizeFunded = min(offer.size, balance || '0')

	if(ledger && offer.expirationTime && ledger.closeTime > offer.expirationTime){
		constrainedOffer.expirationLedgerSequence = ctx.ledgerSequence
	}

	writeTokenOffer({
		ctx,
		...constrainedOffer,
		ledgerSequence: ctx.ledgerSequence
	})
}

export function deriveOfferConstraintsByAccount({ ctx, account }){
	let offers = ctx.db.tokenOffers.iter({
		where: {
			account
		},
		include: {
			book: true
		}
	})

	for(let offer of offers){
		deriveOfferConstraintsByOffer({ ctx, offer })
	}
}