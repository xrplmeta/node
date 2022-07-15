import { decodeCurrencyCode } from '@xrplkit/amount'
import { readTokenPropsReduced, readAccountPropsReduced } from '../../db/helpers/props.js'
import { readTokenExchangeAligned, readTokenExchangeIntervalSeries } from '../../db/helpers/tokenexchanges.js'
import { readTokenMetricIntervalSeries, readTokenMetrics } from '../../db/helpers/tokenmetrics.js'

const defaultTokensPerPage = 100
const maxTokensPerPage = 1000


export function serveTokenList(){
	return ({ ctx, sort, decode_currency, limit, offset }) => {
		let tokens = []
		let caches = ctx.db.tokenCache.readMany({
			include: {
				token: {
					issuer: true
				}
			},
			orderBy: {
				[sort || 'trustlines']: 'desc'
			},
			take: limit,
			skip: offset
		})

		for(let cache of caches){
			let token = {
				currency: decode_currency
					? decodeCurrencyCode(cache.token.currency)
					: cache.token.currency,
				issuer: cache.token.issuer.address,
				meta: {
					
				},
				metrics: {
					trustlines: cache.trustlines,
					holders: cache.holders,
					supply: cache.supply.toString(),
					marketcap: cache.marketcap.toString(),
					price: cache.price.toString(),
					volume_24h: cache.volume24H.toString(),
					volume_7d: cache.volume7D.toString(),
				}
			}

			tokens.push(token)
		}

		return tokens
	}
}


export function serveTokenSummary(){
	return ({ ctx, token, sources }) => {
		let currentLedger = ctx.db.ledgers.readOne({
			orderBy: {
				sequence: 'desc'
			}
		})

		let currentMetrics = readTokenMetrics({
			ctx,
			token,
			ledgerSequence: currentLedger.sequence,
			metrics: {
				trustlines: true,
				holders: true,
				supply: true,
				marketcap: true,
			}
		})

		let currentExchange = readTokenExchangeAligned({
			ctx,
			base: token,
			quote: {
				currency: 'XRP'
			},
			ledgerSequence: currentLedger.sequence
		})

		return {
			currency: token.currency,
			issuer: token.issuer.address,
			meta: {
				token: readTokenPropsReduced({
					ctx,
					token,
					includeSources: !!sources,
				}),
				issuer: readAccountPropsReduced({
					ctx,
					account: token.issuer,
					includeSources: !!sources,
				})
			},
			metrics: {
				trustlines: currentMetrics.trustlines,
				holders: currentMetrics.holders,
				supply: currentMetrics.supply.toString(),
				marketcap: currentMetrics.marketcap.toString(),
				price: currentExchange.price.toString()
			}
		}
	}
}


export function serveTokenPoint(){
	return ({ ctx, token, sequence, time, metric }) => {

	}
}


export function serveTokenSeries(){
	return ({ ctx, token, sequence, time, metric, ...opts }) => {
		let series

		if(metric === 'price'){
			series = readTokenExchangeIntervalSeries({
				ctx,
				base: token,
				quote: {
					id: 1 // XRP
				},
				sequence,
				time
			})
				.map(point => ({
					...point,
					value: point.price
				}))
		}else if(['trustlines', 'holders', 'supply', 'marketcap'].includes(metric)){
			series = readTokenMetricIntervalSeries({
				ctx,
				metric,
				token,
				sequence,
				time
			})
		}else{
			throw {
				type: `invalidParam`,
				message: `Invalid metric. Allowed values are: price, volume, trustlines, holders, supply, marketcap`,
				expose: true
			}
		}

		if(series.length === 0)
			return []

		
		if(time){
			series[0].time = Math.max(
				series[0].time,
				time.start
			)

			return series.map(
				point => ({
					time: Number(point.time), 
					value: point.value.toString() 
				})
			)
		}else{
			series[0].sequence = Math.max(
				series[0].sequence,
				sequence.start
			)

			return series.map(
				point => ({
					sequence: Number(point.sequence), 
					value: point.value.toString() 
				})
			)
		}
	}
}
