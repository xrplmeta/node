const metricTables = {
	trustlines: 'tokenTrustlines',
	holders: 'tokenHolders',
	supply: 'tokenSupply'
}


export function write({ meta, token, ledgerIndex, ...metrics }){
	let point = read({ meta, token, ledgerIndex, ...metrics })

	for(let [key, value] of Object.entries(metrics)){
		let table = metricTables[key]

		if(point[key] === value)
			continue

		meta[table].createOne({
			data: {
				token,
				ledgerIndex,
				value
			}
		})
	}
}

export function read({ meta, token, ledgerIndex, ...metrics }){
	let point = {}

	for(let key of Object.keys(metrics)){
		let table = metricTables[key]

		let entry = meta[table].readOne({
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