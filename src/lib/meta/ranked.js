const rankPadding = 1000000


export function write({ ctx, table, where, ledgerSequence, items, compare, include }){
	let previousItems = read({ ctx, table, where, ledgerSequence, include })
	let unchangedItems = []
	let newItems = []
	let finalItems = []

	let expiredItems = previousItems.filter(
		pi => items.every(
			item => !compare.unique(item, pi)
		)
	)

	let assocs = items.map(
		item => previousItems.findIndex(
			previousItem => compare.unique(item, previousItem)
		)
	)

	let orderIndex = 0

	for(let i=0; i<items.length; i++){
		let item = items[i]
		let previousIndex = assocs[i]

		if(previousIndex === -1){
			newItems.push(item)
		}else{
			let previousItem = previousItems[previousIndex]

			if(previousIndex === orderIndex && compare.diff(item, previousItem)){
				finalItems.push(previousItem)
				unchangedItems.push(previousItem)
			}else{
				finalItems.push({ ...item, id: undefined })
				expiredItems.push(previousItem)
			}

			orderIndex++

			for(let u=i+1; u<items.length; u++){
				if(assocs[u] !== -1)
					break

				finalItems.push({ ...items[u], id: undefined })
				i++
			}

			for(let u=previousIndex+1; u<previousItems.length; u++){
				if(assocs.includes(u))
					break

				orderIndex++
			}
		}
	}

	if(newItems.length > 0){
		finalItems = [
			...newItems.map(
				item => ({ ...item, id: undefined })
			),
			...finalItems
		]
	}

	if(expiredItems.length > 0){
		expire({ ctx, table, ledgerSequence, items: expiredItems })
	}

	let islands = []

	for(let i=0; i<finalItems.length; i++){
		let item = finalItems[i]
		
		if(item.id)
			continue

		let island = {
			start: i,
			end: i,
			items: [item]
		}

		for(let u=i+1; u<finalItems.length; u++){
			let uitem = finalItems[u]
			
			if(uitem.id)
				break

			island.end++
			island.items.push(uitem)
		}

		islands.push(island)
		i = island.end + 1
	}

	
	for(let island of islands){
		if(island.end === finalItems.length - 1){
			let lastRank = unchangedItems.length > 0
				? unchangedItems[unchangedItems.length - 1].rank
				: 0

			for(let i=0; i<island.items.length; i++){
				island.items[i].rank = lastRank + (i + 1) * rankPadding
			}
		}else if(island.start === 0){
			let firstRank = unchangedItems.length > 0
				? unchangedItems[0].rank
				: 0

			for(let i=0; i<island.items.length; i++){
				island.items[i].rank = firstRank - (island.items.length - i) * rankPadding
			}
		}else{
			let headRank = finalItems[island.start - 1].rank
			let tailRank = finalItems[island.end + 1].rank
			let gap = Math.floor((tailRank - headRank) / (island.items.length + 1))

			if(gap < 1){
				expire({ ctx, table, ledgerSequence, items: previousItems })

				return write({ 
					ctx, 
					table, 
					where, 
					ledgerSequence, 
					items, 
					compare, 
					include 
				})
			}

			for(let i=0; i<island.items.length; i++){
				island.items[i].rank = headRank + (i + 1) * gap
			}
		}

		
		for(let item of island.items){
			ctx.meta[table].createOne({
				data: {
					sequenceStart: ledgerSequence,
					sequenceEnd: null,
					...item,
				}
			})
		}
	}
}

export function read({ ctx, table, where, ledgerSequence, include }){
	return ctx.meta[table].readMany({
		where: {
			...where,
			sequenceStart: {
				lessOrEqual: ledgerSequence
			},
			OR: [
				{
					sequenceEnd: null
				},
				{
					sequenceEnd: {
						greaterThan: ledgerSequence
					}
				}
			]
		},
		orderBy: {
			rank: 'asc'
		},
		include
	})
}


function expire({ ctx, table, ledgerSequence, items }){
	let ids = items.map(item => item.id)

	if(ctx.inSnapshot){
		ctx.meta[table].deleteMany({
			where: {
				id: {
					in: ids
				}
			}
		})
	}else{
		ctx.meta[table].deleteMany({
			where: {
				id: {
					in: ids
				},
				sequenceStart: ledgerSequence
			}
		})
	
		ctx.meta[table].updateMany({
			data: {
				sequenceEnd: ledgerSequence
			},
			where: {
				id: {
					in: ids
				}
			}
		})
	}
}