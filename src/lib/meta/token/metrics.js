import { eq } from '@xrplkit/xfl'
import { write as writeSimple, read as readSimple } from '../simple.js'

const metricTypes = {
	trustlines: {
		table: 'tokenTrustlines',
		compare: (a, b) => a?.value == b?.value
	},
	holders: {
		table: 'tokenHolders',
		compare: (a, b) => a?.value == b?.value
	},
	supply: {
		table: 'tokenSupply',
		compare: (a, b) => eq(a?.value || '0', b?.value || '0')
	},
	marketcap: {
		table: 'tokenMarketcap',
		compare: (a, b) => eq(a?.value || '0', b?.value || '0')
	}
}


export function write({ ctx, token, ledgerSequence, metrics }){
	for(let [key, value] of Object.entries(metrics)){
		writeSimple({
			ctx,
			table: metricTypes[key].table,
			where: {
				token
			},
			ledgerSequence,
			item: { value },
			compare: metricTypes[key].compare
		})
	}
}

export function read({ ctx, token, ledgerSequence, metrics }){
	let point = {}

	for(let key of Object.keys(metrics)){
		let entry = readSimple({
			ctx,
			table: metricTypes[key].table,
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