import { write as writeSimple, read as readSimple } from '../simple.js'


const metricTables = {
	trustlines: 'tokenTrustlines',
	holders: 'tokenHolders',
	supply: 'tokenSupply',
	marketcap: 'tokenMarketcap',
}


export function write({ ctx, token, ledgerIndex, metrics }){
	for(let [key, value] of Object.entries(metrics)){
		writeSimple({
			ctx,
			table: metricTables[key],
			where: {
				token
			},
			ledgerIndex,
			item: { value },
			compare: (a, b) => a === b
		})
	}
}

export function read({ ctx, token, ledgerIndex, metrics }){
	let point = {}

	for(let key of Object.keys(metrics)){
		let entry = readSimple({
			ctx,
			table: metricTables[key],
			where: {
				token
			},
			ledgerIndex
		})

		if(entry)
			point[key] = entry.value
	}

	return point
}