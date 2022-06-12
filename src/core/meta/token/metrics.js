const metricTables = {
	trustlines: 'tokenTrustlines',
	holders: 'tokenHolders',
	supply: 'tokenSupply',
	marketcap: 'tokenMarketcap',
}


export function write({ ctx, token, ledgerIndex, metrics }){
	let point = read({ ctx, token, ledgerIndex, metrics })

	for(let [key, value] of Object.entries(metrics)){
		let table = metricTables[key]

		if(point[key] === value)
			continue

		ctx.meta[table].createOne({
			data: {
				token,
				ledgerIndex,
				value
			}
		})
	}
}

export function read({ ctx, token, ledgerIndex, metrics }){
	let point = {}

	for(let key of Object.keys(metrics)){
		let table = metricTables[key]

		let entry = ctx.meta[table].readOne({
			where: {
				token,
				ledgerIndex: {
					lessOrEqual: ledgerIndex
				}
			},
			orderBy: {
				ledgerIndex: 'desc'
			},
			take: 1
		})

		if(entry)
			point[key] = entry.value
	}

	return point
}