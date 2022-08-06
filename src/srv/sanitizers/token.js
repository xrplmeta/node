import { encodeCurrencyCode } from '@xrplkit/amount'


const sortKeymap = {
	trustlines_delta_24h: 'trustlinesDelta24H',
	trustlines_percent_24h: 'trustlinesPercent24H',
	trustlines_delta_7d: 'trustlinesDelta7D',
	trustlines_percent_7d: 'trustlinesPercent7D',
	holders: 'holders',
	holders_delta_24h: 'holdersDelta24H',
	holders_percent_24h: 'holdersPercent24H',
	holders_delta_7d: 'holdersDelta7D',
	holders_percent_7d: 'holdersPercent7D',
	supply: 'supply',
	supply_delta_24h: 'supplyDelta24H',
	supply_percent_24h: 'supplyPercent24H',
	supply_delta_7d: 'supplyDelta7D',
	supply_percent_7d: 'supplyPercent7D',
	marketcap: 'marketcap',
	marketcap_delta_24h: 'marketcapDelta24H',
	marketcap_percent_24h: 'marketcapPercent24H',
	marketcap_delta_7d: 'marketcapDelta7D',
	marketcap_percent_7d: 'marketcapPercent7D',
	price_percent_24h: 'pricePercent24H',
	price_percent_7d: 'pricePercent7D',
	volume_24h: 'volume24H',
	volume_7d: 'volume7D',
	exchanges_24h: 'exchanges24H',
	exchanges_7d: 'exchanges7D',
	takers_24h: 'takers24H',
	takers_7d: 'takers7D',
	trustlines: 'trustlines',
}


export function sanitizeToken({ key, array = false }){
	function parse(ctx, { currency, issuer }){
		let token = ctx.db.tokens.readOne({
			where: {
				currency: encodeCurrencyCode(currency),
				issuer: {
					address: issuer
				}
			},
			include: {
				issuer: true
			}
		})
	
		if(!token){
			throw {
				type: `entryNotFound`,
				message: `The token '${currency}' issued by '${issuer}' does not exist.`,
				expose: true
			}
		}

		return token
	}

	return ({ ctx, ...args }) => {
		if(!args.hasOwnProperty(key))
			throw {
				type: `missingParam`,
				message: `No token specified.`,
				expose: true
			}

		if(array){
			return {
				...args,
				ctx,
				[key]: args[key].map(token => parse(ctx, token)),
			}
		}else{
			return {
				...args,
				ctx,
				[key]: parse(ctx, args[key]),
			}
		}
	}
}

export function sanitizeTrustLevels(){
	return ({ ctx, trust_levels, ...args }) => {
		if(trust_levels){
			if(!Array.isArray(trust_levels)){
				throw {
					type: `invalidParam`,
					message: `The trust levels need to be specified as an array.`,
					expose: true
				}
			}

			trust_levels = trust_levels.map(level => parseInt(level))

			if(trust_levels.some(level => level < 0 || level > 3)){
				throw {
					type: `invalidParam`,
					message: `The trust levels need to be between 0 and 3.`,
					expose: true
				}
			}
		}

		return {
			...args,
			ctx,
			trust_levels
		}
	}
}

export function sanitizeTokenListSortBy(){
	return ({ ctx, sort_by, ...args }) => {
		if(sort_by){
			sort_by = sortKeymap[sort_by]

			if(!sort_by){
				throw {
					type: `invalidParam`,
					message: `This sorting mode is not allowed. Possible values are: ${
						Object.keys(sortKeymap)
							.map(key => `${key}`)
							.join(', ')
					}'`,
					expose: true
				}
			}
		}

		return {
			...args,
			ctx,
			sort_by
		}
	}
}