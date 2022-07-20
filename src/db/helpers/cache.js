import log from '@mwni/log'
import { sub, mul, div, min, gt } from '@xrplkit/xfl'
import { unixNow } from '@xrplkit/time'
import { readLedgerAt, readMostRecentLedger } from './ledgers.js'
import { readTokenMetrics } from './tokenmetrics.js'
import { readTokenExchangeAligned, readTokenVolume } from './tokenexchanges.js'
import { readAccountProps, readTokenProps } from './props.js'


const maxChangePercent = 999999999
const metricInts = ['trustlines', 'holders']


export function updateCacheForEverything({ ctx }){
	log.time.info(`cache.update.all`, `updating token cache ...`)

	let tokens = ctx.db.tokens.iter()

	for(let token of tokens){
		updateCacheForTokenProps({ ctx, token })
		updateCacheForAccountProps({ ctx, account: token.issuer })
		updateCacheForTokenExchanges({ ctx, token })
		updateCacheForTokenMetrics({ 
			ctx,
			token, 
			metrics: {
				trustlines: true,
				holders: true,
				supply: true,
				marketcap: true
			}
		})
	}

	log.time.info(`cache.update.all`, `updating token cache took %`)
}


export function updateCacheForTokenProps({ ctx, token }){
	if(ctx.backwards)
		return

	let props = readTokenProps({ ctx, token })

	ctx.db.tokenCache.createOne({
		data: {
			token,
			tokenProps: props,
			trustLevel: Math.max(
				...props
					.filter(({ key }) => key === 'trust_level')
					.map(({ value }) => value)
			)
		}
	})
}

export function updateCacheForAccountProps({ ctx, account }){
	if(ctx.backwards)
		return
	
	let tokens = ctx.db.tokens.readMany({
		where: {
			issuer: account
		}
	})

	for(let token of tokens){
		if(!token.issuer)
			continue

		ctx.db.tokenCache.createOne({
			data: {
				token,
				issuerProps: readAccountProps({ 
					ctx, 
					account: token.issuer 
				})
			}
		})
	}
}

export function updateCacheForTokenMetrics({ ctx, token, metrics }){
	if(ctx.backwards)
		return

	let cache = {}
	let sequences = getCommonLedgerSequences({ ctx })

	let currentValues = readTokenMetrics({
		ctx,
		token,
		metrics,
		ledgerSequence: sequences.current
	})

	let pre24hValues = readTokenMetrics({
		ctx,
		token,
		metrics,
		ledgerSequence: sequences.pre24h
	})

	let pre7dValues = readTokenMetrics({
		ctx,
		token,
		metrics,
		ledgerSequence: sequences.pre7d
	})

	for(let key of Object.keys(metrics)){
		let current = currentValues[key] || 0
		let pre24h = pre24hValues[key] || 0
		let pre7d = pre7dValues[key] || 0
		let delta24h = sub(current, pre24h)
		let delta7d = sub(current, pre7d)

		let percent24h = gt(pre24h, 0)
			? Number(min(mul(div(delta24h, pre24h), 100), maxChangePercent))
			: 0

		let percent7d = gt(pre7d, 0)
			? Number(min(mul(div(delta7d, pre7d), 100), maxChangePercent))
			: 0

		if(metricInts.includes(key)){
			delta24h = Number(delta24h)
			delta7d = Number(delta7d)
		}

		cache[key] = current
		cache[`${key}Delta24H`] = delta24h
		cache[`${key}Percent24H`] = percent24h
		cache[`${key}Delta7D`] = delta7d
		cache[`${key}Percent7D`] = percent7d
	}

	ctx.db.tokenCache.createOne({
		data: {
			token,
			...cache
		}
	})
}

export function updateCacheForTokenExchanges({ ctx, token }){
	if(ctx.backwards)
		return

	if(token.currency === 'XRP')
		return

	let sequences = getCommonLedgerSequences({ ctx })

	let current = readTokenExchangeAligned({
		ctx,
		base: token,
		quote: {
			currency: 'XRP'
		},
		ledgerSequence: sequences.current
	})?.price || 0

	let pre24h = readTokenExchangeAligned({
		ctx,
		base: token,
		quote: {
			currency: 'XRP'
		},
		ledgerSequence: sequences.pre24h
	})?.price || 0

	let pre7d = readTokenExchangeAligned({
		ctx,
		base: token,
		quote: {
			currency: 'XRP'
		},
		ledgerSequence: sequences.pre7d
	})?.price || 0

	let delta24h = sub(current, pre24h)
	let delta7d = sub(current, pre7d)

	let percent24h = gt(pre24h, 0)
		? Number(min(mul(div(delta24h, pre24h), 100), maxChangePercent))
		: 0

	let percent7d = gt(pre7d, 0)
		? Number(min(mul(div(delta7d, pre7d), 100), maxChangePercent))
		: 0

	let volume24H = readTokenVolume({
		ctx,
		base: token,
		quote: {
			id: 1,
			currency: 'XRP'
		},
		sequenceStart: sequences.pre24h,
		sequenceEnd: sequences.current
	})

	let volume7D = readTokenVolume({
		ctx,
		base: token,
		quote: {
			id: 1,
			currency: 'XRP'
		},
		sequenceStart: sequences.pre7d,
		sequenceEnd: sequences.current
	})

	ctx.db.tokenCache.createOne({
		data: {
			token,
			price: current,
			pricePercent24H: percent24h,
			pricePercent7D: percent7d,
			volume24H,
			volume7D
		}
	})
}


function getCommonLedgerSequences({ ctx }){
	let now = unixNow()
	
	return {
		current: readMostRecentLedger({ ctx }).sequence,
		pre24h: readLedgerAt({ 
			ctx, 
			time: now - 60 * 60 * 24, 
			clamp: true 
		}).sequence,
		pre7d: readLedgerAt({ 
			ctx, 
			time: now - 60 * 60 * 24 * 7, 
			clamp: true 
		}).sequence
	}
}