import { deriveOfferConstraintsByOffer, deriveOfferConstraintsByAccount } from './scopes/offercons.js'
import { deriveMarketcap } from './scopes/marketcaps.js'


export function deriveComposites({ ctx, scopes }){
	for(let { token, offer, account, changes } of scopes){
		if(token){
			deriveMarketcap({ ctx, token })
		}else if(offer){
			if(changes.has('created'))
				deriveOfferConstraintsByOffer({ ctx, offer })
		}else if(account){
			if(changes.has('balances'))
				deriveOfferConstraintsByAccount({ ctx, account })
		}
	}
}

export function deriveAllComposites({ ctx }){
	let tokens = ctx.db.tokens.iter()

	for(let token of tokens){
		deriveMarketcap({ ctx, token })
	}

	let offers = ctx.db.tokenOffers.iter({
		include: {
			book: true
		}
	})

	for(let offer of offers){
		deriveOfferConstraintsByOffer({ ctx, offer })
	}
}