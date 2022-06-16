import { eq, gt } from '@xrplkit/xfl'


const rankPadding = 1000000


export function write({ ctx, table, where, ledgerIndex, items, compare, rankBy, include }){
	let newItems = []
	let previousItems = read({ ctx, table, where, ledgerIndex, include })
		.reverse()
		
	let expiredItems = previousItems.filter(
		pi => items.every(
			item => !compare.unique(item, pi)
		)
	)
	let unchangedItems = previousItems.filter(
		pi => !expiredItems.includes(pi)
	)

	for(let index=0; index<items.length; index++){
		let item = items[index]
		let previousIndex = previousItems.findIndex(
			pi => compare.unique(item, pi)
		)
		
		if(previousIndex === -1){
			newItems.push(item)
		}else{
			let previousItem = previousItems[previousIndex]

			if(compare.diff(item, previousItem))
				continue

			if(ctx.inSnapshot){
				item.sequenceStart = Math.max(
					item.sequenceStart, 
					previousItem.sequenceStart
				)
			}
			
			newItems.push(item)
			expiredItems.push(previousItem)
			unchangedItems = unchangedItems.filter(
				ui => ui !== previousItem
			)
		}
	}

	if(expiredItems.length > 0){
		expire({ ctx, table, ledgerIndex, items: expiredItems })
	}

	for(let item of expiredItems){
		ctx.meta[table].updateOne({
			data: {
				sequenceEnd: ledgerIndex
			},
			where: {
				id: item.id
			}
		})
	}

	let finalItems = unchangedItems.slice()

	for(let { id, ...item } of newItems){
		let greaterIndex = finalItems
			.findIndex(ui => gt(ui[rankBy], item[rankBy]))

		if(greaterIndex === -1){
			finalItems.push(item)
		}else if(greaterIndex === 0){
			finalItems.unshift(item)
		}else{
			finalItems.splice(greaterIndex, 0, item)
		}
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
				expire({ ctx, table, ledgerIndex, items: previousItems })

				return write({ 
					ctx, 
					table, 
					where, 
					ledgerIndex, 
					items, 
					compare, 
					rankBy, 
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
					sequenceStart: ledgerIndex,
					sequenceEnd: null,
					...item,
				}
			})
		}
	}
}

export function read({ ctx, table, where, ledgerIndex, include, limit, offset }){
	return ctx.meta[table].readMany({
		where: {
			...where,
			AND: [
				{
					OR: [
						{
							sequenceStart: null
						},
						{
							sequenceStart: {
								lessOrEqual: ledgerIndex
							}
						}
					]
				},
				{
					OR: [
						{
							sequenceEnd: null
						},
						{
							sequenceEnd: {
								greaterThan: ledgerIndex
							}
						}
					]
				}
			]
		},
		orderBy: {
			rank: 'desc'
		},
		include,
		take: limit,
		skip: offset
	})
}


function expire({ ctx, table, ledgerIndex, items }){
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
				sequenceStart: ledgerIndex
			}
		})
	
		ctx.meta[table].updateMany({
			data: {
				sequenceEnd: ledgerIndex
			},
			where: {
				id: {
					in: ids
				}
			}
		})
	}
}