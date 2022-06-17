import { write as writeSimple, read as readSimple } from '../simple.js'


const metricTables = {
	trustlines: 'tokenTrustlines',
	holders: 'tokenHolders',
	supply: 'tokenSupply',
	marketcap: 'tokenMarketcap',
}


export function write({ ctx, token, ledgerSequence, metrics }){
	for(let [key, value] of Object.entries(metrics)){
		writeSimple({
			ctx,
			table: metricTables[key],
			where: {
				token
			},
			ledgerSequence,
			item: { value },
			compare: (a, b) => a.value === b.value
		})
	}
}

export function read({ ctx, token, ledgerSequence, metrics }){
	let point = {}

	for(let key of Object.keys(metrics)){
		let entry = readSimple({
			ctx,
			table: metricTables[key],
			where: {
				token
			},
			ledgerSequence
		})

		if(entry)
			point[key] = entry.value
	}

	return point
}