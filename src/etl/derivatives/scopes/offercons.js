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

	for(let offer of offers){
		applyCommon({ ctx, offer, balance: balance.balance })
	}
}

function applyCommon({ ctx, offer, balance }){
	let constrainedOffer = { ...offer }

	let ledger = ctx.db.ledgers.readOne({
		where: {
			sequence: ctx.ledgerSequence
		}
	})

	constrainedOffer.sizeFunded = min(
		offer.size, 
		balance || '0'
	)

	if(ledger && offer.expirationTime && ledger.closeTime > offer.expirationTime){
		constrainedOffer.lastLedgerSequence = ctx.ledgerSequence - 1
	}

	writeTokenOffer({
		ctx,
		...constrainedOffer,
		ledgerSequence: ctx.ledgerSequence
	})
}