import { decodeCurrencyCode } from '@xrplkit/amount'
import { reduceProps } from '../../db/helpers/props.js'
import { readTokenExchangeIntervalSeries } from '../../db/helpers/tokenexchanges.js'
import { readTokenMetricIntervalSeries } from '../../db/helpers/tokenmetrics.js'


export function serveTokenList(){
	return ({ ctx, sort_by, trust_levels, decode_currency, prefer_sources, expand_meta, include_changes, limit, offset }) => {
		let tokens = []
		let caches = ctx.db.tokenCache.readMany({
			where: trust_levels
				? {
					trustLevel: {
						in: trust_levels
					}
				}
				: undefined,
			include: {
				token: {
					issuer: true
				}
			},
			orderBy: {
				[sort_by || 'trustlines']: 'desc'
			},
			take: limit,
			skip: offset
		})

		for(let cache of caches){
			tokens.push(
				formatTokenCache({
					ctx,
					cache,
					decodeCurrency: decode_currency,
					preferSources: prefer_sources,
					expandMeta: expand_meta,
					includeChanges: include_changes,
				})
			)
		}

		return tokens
	}
}

export function subscribeTokenList(){
	return ({ ctx, tokens, decode_currency, prefer_sources, expand_meta, include_changes }) => {
		for(let token of tokens){
			ctx.client.tokenSubscriptions[token.id] = {
				token: {
					currency: token.currency,
					issuer: token.issuer.address
				},
				decode_currency,
				prefer_sources,
				expand_meta,
				include_changes
			}
		}

		return {
			subscriptions: Object.values(
				ctx.client.tokenSubscriptions
			)
		}
	}
}

export function unsubscribeTokenList(){
	return ({ ctx, tokens }) => {
		for(let token of tokens){
			delete ctx.client.tokenSubscriptions[token.id]
		}

		return {
			subscriptions: Object.values(
				ctx.client.tokenSubscriptions
			)
		}
	}
}

export function serveTokenSummary(){
	return ({ ctx, token, decode_currency, prefer_sources, expand_meta, include_changes }) => {
		let cache = ctx.db.tokenCache.readOne({
			where: {
				token
			},
			include: {
				token: {
					issuer: true
				}
			}
		})

		return formatTokenCache({
			ctx,
			cache,
			decodeCurrency: decode_currency,
			preferSources: prefer_sources,
			expandMeta: expand_meta,
			includeChanges: include_changes,
		})
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
				.filter((point, i, list) => {
					if(i >= list.length - 1)
						return true

					if(point.time !== list[i+1].time)
						return true
				})
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
				message: `Invalid metric. Allowed values are: price, volume, trustlines, holders, supply, marketcap.`,
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


export function formatTokenCache({ ctx, cache, decodeCurrency, preferSources, expandMeta, includeChanges }){
	let token = {
		currency: decodeCurrency
			? decodeCurrencyCode(cache.token.currency)
			: cache.token.currency,
		issuer: cache.token.issuer.address,
		meta: {
			token: reduceProps({
				props: cache.tokenProps || [],
				expand: expandMeta,
				sourceRanking: [
					...(preferSources || []),
					...(ctx.config.server?.sourceRanking || [])
				]
			}),
			issuer: reduceProps({
				props: cache.issuerProps || [],
				expand: expandMeta,
				sourceRanking: [
					...(preferSources || []),
					...(ctx.config.server?.sourceRanking || [])
				]
			})
		},
		metrics: {
			trustlines: cache.trustlines,
			holders: cache.holders,
			supply: cache.supply.toString(),
			marketcap: cache.marketcap.toString(),
			price: cache.price.toString(),
			volume_24h: cache.volume24H.toString(),
			volume_7d: cache.volume7D.toString(),
			exchanges_24h: cache.exchanges24H.toString(),
			exchanges_7d: cache.exchanges7D.toString(),
			takers_24h: cache.takers24H.toString(),
			takers_7d: cache.takers7D.toString(),
		}
	}

	if(includeChanges){
		token.metrics.changes = {
			'24h': {
				trustlines: {
					delta: cache.trustlinesDelta24H,
					percent: cache.trustlinesPercent24H,
				},
				holders: {
					delta: cache.holdersDelta24H,
					percent: cache.holdersPercent24H,
				},
				supply: {
					delta: cache.supplyDelta24H.toString(),
					percent: cache.supplyPercent24H,
				},
				marketcap: {
					delta: cache.marketcapDelta24H.toString(),
					percent: cache.marketcapPercent24H,
				},
				price: {
					percent: cache.pricePercent24H,
				}
			},
			'7d': {
				trustlines: {
					delta: cache.trustlinesDelta7D,
					percent: cache.trustlinesPercent7D,
				},
				holders: {
					delta: cache.holdersDelta7D,
					percent: cache.holdersPercent7D,
				},
				supply: {
					delta: cache.supplyDelta7D.toString(),
					percent: cache.supplyPercent7D,
				},
				marketcap: {
					delta: cache.marketcapDelta7D.toString(),
					percent: cache.marketcapPercent7D,
				},
				price: {
					percent: cache.pricePercent7D,
				}
			}
		}
	}

	return token
}