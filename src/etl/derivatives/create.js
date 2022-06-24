import { applyOfferConstraintsByOffer, applyOfferConstraintsByBalance } from './scopes/offercons.js'
import { updateMarketcapByExchange, updateMarketcapBySupply } from './scopes/marketcaps.js'


export function createDerivatives({ ctx, newItems }){
	for(let exchange of newItems.tokenExchanges){
		updateMarketcapByExchange({ ctx, exchange })
	}

	for(let supply of newItems.tokenSupply){
		updateMarketcapBySupply({ ctx, supply })
	}

	for(let offer of newItems.tokenOffers){
		applyOfferConstraintsByOffer({ ctx, offer })
	}

	for(let balance of newItems.accountBalances){
		applyOfferConstraintsByBalance({ ctx, balance })
	}
}

export function createAllDerivatives({ ctx }){
	let exchanges = ctx.db.tokenExchanges.iter()

	for(let exchange of exchanges){
		updateMarketcapByExchange({ ctx, exchange })
	}

	let offers = ctx.db.tokenOffers.iter({
		include: {
			book: true
		}
	})

	for(let offer of offers){
		applyOfferConstraintsByOffer({ ctx, offer })
	}
}