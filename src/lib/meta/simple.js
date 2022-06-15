export function write({ ctx, table, where, ledgerIndex, item, compare }){
	let point = read({ ctx, table, where, ledgerIndex })

	if(compare(point, item))
		return

	ctx.meta[table].createOne({
		data: {
			...where,
			...item,
			ledgerIndex
		}
	})
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