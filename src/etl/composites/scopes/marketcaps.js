import { mul } from '@xrplkit/xfl'
import { readTokenMetrics, writeTokenMetrics } from '../../../db/helpers/tokenmetrics.js'
import { readTokenExchangeAligned } from '../../../db/helpers/tokenexchanges.js'


export function deriveMarketcap({ ctx, token }){
	let { supply } = readTokenMetrics({
		ctx,
		token,
		ledgerSequence: ctx.ledgerSequence,
		metrics: {
			supply: true
		}
	})

	let exchange = readTokenExchangeAligned({
		ctx,
		base: token,
		quote: { 
			currency: 'XRP',
			issuer: null
		},
		ledgerSequence: ctx.ledgerSequence
	})

	let marketcap = 0

	if(supply && exchange){
		marketcap = mul(supply, exchange.price)
	}

	writeTokenMetrics({
		ctx,
		token,
		ledgerSequence: ctx.ledgerSequence,
		metrics: {
			marketcap
		}
	})
}

