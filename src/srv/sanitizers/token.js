const sortKeymap = {
	trustlines: 'trustlines',
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
}


export function sanitizeToken({ key }){
	return ({ ctx, ...args }) => {
		if(!args.hasOwnProperty(key))
			throw {
				type: `missingParam`,
				message: `No token specified.`,
				expose: true
			}

		let { currency, issuer } = args[key]
		let token = ctx.db.tokens.readOne({
			where: {
				currency,
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
	
		return {
			...args,
			ctx,
			[key]: token,
		}
	}
}

export function sanitizeTokenListSortBy(){
	return ({ ctx, sort, ...args }) => {
		if(sort){
			sort = sortKeymap[sort]

			if(!sort){
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
			sort
		}
	}
}