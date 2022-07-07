import { mul } from '@xrplkit/xfl'
import { readTokenMetrics, writeTokenMetrics } from '../../../../db/helpers/tokenmetrics.js'
import { readTokenExchangeAligned, alignTokenExchange } from '../../../../db/helpers/tokenexchanges.js'


export function updateMarketcapByExchange({ ctx, exchange }){
	try{
		exchange = alignTokenExchange({
			exchange,
			quote: { currency: 'XRP' }
		})
	}catch{
		return
	}

	if(ctx.backwards){
		let firstMarketcap = ctx.db.tokenMarketcap.readOne({
			where: {
				token,
				ledgerSequence: {
					greaterOrEqual: ctx.ledgerSequence
				},
				orderBy: {
					ledgerSequence: 'asc'
				}
			}
		})

		let series = readTokenMetricSeries({
			ctx,
			token,
			metric: 'supply',
			sequenceStart: ctx.ledgerSequence,
			sequenceEnd: firstMarketcap?.ledgerSequence
		})

		for(let { ledgerSequence: sequence, value: supply } of series){
			writeTokenMetrics({
				ctx,
				token,
				ledgerSequence: sequence,
				metrics: {
					marketcap: supply
						? mul(supply, exchange.price)
						: '0'
				}
			})
		}
	}else{
		let { supply } = readTokenMetrics({
			ctx,
			token,
			ledgerSequence: ctx.ledgerSequence,
			metrics: {
				supply: true
			}
		})
	
		writeTokenMetrics({
			ctx,
			token,
			ledgerSequence: ctx.ledgerSequence,
			metrics: {
				marketcap: supply
					? mul(supply, exchange.price)
					: '0'
			}
		})
	}

	
}

export function updateMarketcapBySupply({ ctx, supply }){
	let exchange = readTokenExchangeAligned({
		ctx,
		base: supply.token,
		quote: { 
			currency: 'XRP',
			issuer: null
		},
		ledgerSequence: ctx.ledgerSequence
	})

	if(ctx.backwards && !exchange)
		return

	writeTokenMetrics({
		ctx,
		token: supply.token,
		ledgerSequence: ctx.ledgerSequence,
		metrics: {
			marketcap: exchange
				? mul(supply.value, exchange.price)
				: '0'
		}
	})
}