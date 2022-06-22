import { readPoint, writePoint, clearPoint } from '../../lib/datapoints.js'


const tokenTables = {
	trustlines: 'tokenTrustlines',
	holders: 'tokenHolders',
	supply: 'tokenSupply',
	marketcap: 'tokenMarketcap'
}


export function readTokenMetrics({ ctx, token, ledgerSequence, metrics }){
	let point = {}

	for(let key of Object.keys(metrics)){
		let entry = readPoint({
			table: ctx.db[tokenTables[key]],
			selector: {
				token
			},
			ledgerSequence
		})

		if(entry){
			point[key] = entry.value
		}
	}

	return point
}

export function writeTokenMetrics({ ctx, token, ledgerSequence, metrics }){
	for(let [key, value] of Object.entries(metrics)){
		if(value.toString() == '0'){
			clearPoint({
				table: ctx.db[tokenTables[key]],
				selector: {
					token
				},
				ledgerSequence
			})
		}else{
			writePoint({
				table: ctx.db[tokenTables[key]],
				selector: {
					token
				},
				ledgerSequence,
				data: { 
					value 
				}
			})
		}
	}
}