import { eq, gt } from '@xrplkit/xfl'


const rankPadding = 10


export function writeRanked({ ctx, table, where, ledgerIndex, items, compare, rankBy, include }){
	let newItems = []
	let previousItems = readRanked({ ctx, table, where, ledgerIndex, include })
	let expiredItems = previousItems.filter(
		pi => items.every(
			item => compare.unique(item, pi)
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
			
			newItems.push(item)
			expiredItems.push(previousItem)
			unchangedItems = unchangedItems.filter(
				ui => ui !== previousItem
			)
		}
	}

	for(let item of expiredItems){
		ctx.meta[table].updateOne({
			data: {
				expirationLedgerIndex: ledgerIndex
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
		i = island.end+1
	}

	let writeItems = []

	for(let island of islands){
		console.log(island)
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
				island.items[i].rank = firstRank - (island.items.length - i + 1) * rankPadding
			}
		}else{
			let headRank = finalItems[island.start]
			let tailRank = finalItems[island.end]
		}

		for(let item of island.items){
			ctx.meta[table].createOne({
				data: {
					...item,
					ledgerIndex,
					expirationLedgerIndex: null
				}
			})
		}
	}
}

export function readRanked({ ctx, table, where, ledgerIndex, include, limit, offset }){
	return ctx.meta[table].readMany({
		where: {
			...where,
			ledgerIndex: {
				lessOrEqual: ledgerIndex
			},
			OR: [
				{
					expirationLedgerIndex: null
				},
				{
					expirationLedgerIndex: {
						greaterThan: ledgerIndex
					}
				}
			]
		},
		orderBy: {
			rank: 'asc'
		},
		include,
		take: limit,
		skip: offset
	})
}