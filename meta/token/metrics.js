const metricTables = {
	trustlines: 'tokenTrustlines',
	holders: 'tokenHolders',
	supply: 'tokenSupply'
}


export async function storeMetricPoint({ meta, token, ledgerIndex, ...metrics }){
	let point = await getMetricPoint({ meta, token, ledgerIndex, ...metrics })

	for(let [key, value] of Object.entries(metrics)){
		let table = metricTables[key]

		if(point[key] === value)
			continue

		await meta[table].createOne({
			data: {
				token,
				ledgerIndex,
				value
			}
		})
	}
}

export async function getMetricPoint({ meta, token, ledgerIndex, ...metrics }){
	let point = {}

	for(let key of Object.keys(metrics)){
		let table = metricTables[key]

		let entry = await meta[table].readOne({
			where: {
				token,
				ledgerIndex: {
					lessThanOrEqual: ledgerIndex
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