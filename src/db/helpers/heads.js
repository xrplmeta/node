const relevantTables = [
	'accountBalances',
	'tokenExchanges',
	'tokenSupply',
	'tokenOffers'
]


export function readTableHeads({ ctx }){
	return relevantTables.reduce(
		(heads, table) => ({
			...heads,
			[table]: ctx.db[table].readOne({
				orderBy: {
					id: 'desc'
				}
			})?.id || 0
		}),
		{}
	)
}

export function pullNewItems({ ctx, previousHeads }){
	return relevantTables.reduce(
		(heads, table) => ({
			...heads,
			[table]: ctx.db[table].readMany({
				where: {
					id: {
						greaterThan: previousHeads[table]
					}
				}
			})
		}),
		{}
	)
}