import { readTokenPropsReduced, readAccountPropsReduced } from '../../db/helpers/props.js'
import { readTokenExchangeAligned } from '../../db/helpers/tokenexchanges.js'
import { readTokenMetrics } from '../../db/helpers/tokenmetrics.js'
import { readTokenMetricSeries, readTokenExchangeSeries } from './utils.js'


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
			series = readTokenExchangeSeries({
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
		}else if(metric === 'trustlines'){
			series = readTokenMetricSeries({
				ctx,
				table: 'tokenTrustlines',
				token,
				sequence,
				time
			})
		}else if(metric === 'holders'){
			series = readTokenMetricSeries({
				ctx,
				table: 'tokenHolders',
				token,
				sequence,
				time
			})
		}else if(metric === 'supply'){
			series = readTokenMetricSeries({
				ctx,
				table: 'tokenSupply',
				token,
				sequence,
				time
			})
		}else if(metric === 'marketcap'){
			series = readTokenMetricSeries({
				ctx,
				table: 'tokenMarketcap',
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
