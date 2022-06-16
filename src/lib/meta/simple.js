export function write({ ctx, table, where, ledgerIndex, item, compare }){
	let point = read({ 
		ctx, 
		table, 
		where, 
		ledgerIndex: ctx.inSnapshot
			? 1_000_000_000_000
			: ledgerIndex
	})

	if(ctx.inSnapshot && point){
		ctx.meta[table].updateOne({
			data: {
				...item,
				ledgerIndex: Math.max(ledgerIndex, point.ledgerIndex)
			},
			where: {
				id: point.id
			}
		})
	}else{
		if(point && compare(point, item))
			return

		ctx.meta[table].createOne({
			data: {
				...where,
				...item,
				ledgerIndex
			}
		})
	}
}

export function read({ ctx, table, where, ledgerIndex }){
	return ctx.meta[table].readOne({
		where: {
			...where,
			ledgerIndex: {
				lessOrEqual: ledgerIndex
			}
		},
		orderBy: {
			ledgerIndex: 'desc'
		},
		take: 1
	})
}