import { min } from '@xrplkit/xfl'
import { readBalance } from '../../../db/helpers/balances.js'
import { readOffersBy, writeTokenOffer } from '../../../db/helpers/tokenoffers.js'


export function applyOfferConstraintsByOffer({ ctx, offer }){
	let balance = readBalance({
		ctx,
		account: offer.account,
		token: offer.book.takerGets,
		ledgerSequence: ctx.ledgerSequence
	})

	applyCommon({ ctx, offer, balance })
}

export function applyOfferConstraintsByBalance({ ctx, balance }){
	let offers = readOffersBy({
		ctx,
		account: balance.account,
		book: {
			takerGets: balance.token
		},
		ledgerSequence: ctx.ledgerSequence
	})

	if(offers.length === 0)
		return

	for(let offer of offers){
		applyCommon({ ctx, offer, balance: balance.balance })
	}
}

function applyCommon({ ctx, offer, balance }){
	let constrainedOffer = { ...offer }

	constrainedOffer.sizeFunded = min(
		offer.size, 
		balance || '0'
	)

	if(ctx.currentLedger && offer.expirationTime && ctx.currentLedger.closeTime > offer.expirationTime){
		constrainedOffer.lastLedgerSequence = ctx.currentLedger.sequence - 1
	}

	writeTokenOffer({
		ctx,
		...constrainedOffer,
		ledgerSequence: ctx.ledgerSequence
	})
}