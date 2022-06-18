export function write({ ctx, table, where, ledgerSequence, item, compare }){
	let point = read({ 
		ctx, 
		table, 
		where, 
		ledgerSequence: ctx.inSnapshot
			? 1_000_000_000_000
			: ledgerSequence
	})

	if(ctx.inSnapshot && point){
		ctx.meta[table].updateOne({
			data: {
				...item,
				ledgerSequence: Math.max(ledgerSequence, point.ledgerSequence)
			},
			where: {
				id: point.id
			}
		})
	}else{
		if(compare(point, item))
			return

		ctx.meta[table].createOne({
			data: {
				...where,
				...item,
				ledgerSequence
			}
		})
	}
}

export function read({ ctx, table, where, ledgerSequence }){
	return ctx.meta[table].readOne({
		where: {
			...where,
			ledgerSequence: {
				lessOrEqual: ledgerSequence
			}
		},
		orderBy: {
			ledgerSequence: 'desc'
		},
		take: 1
	})
}