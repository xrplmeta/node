const tokenMetricTables = {
	trustlines: 'tokenTrustlines',
	holders: 'tokenHolders',
	supply: 'tokenSupply'
}


export async function storeTokenMetricPoint({ meta, token, ledgerIndex, ...metrics }){
	for(let [key, value] of Object.entries(metrics)){
		let table = tokenMetricTables[key]

		await meta[table].createOne({
			data: {
				token,
				ledgerIndex,
				value
			}
		})
	}
}

export async function getTokenMetricPoint({ meta, token, ledgerIndex, ...metrics }){

}