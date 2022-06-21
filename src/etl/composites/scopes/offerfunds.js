import { min } from '@xrplkit/xfl'
import { read as readBalance } from '../../lib/meta/generic/balances.js'


export function updateAll({ ctx }){
	let books = ctx.meta.tokenOffers.iter({
		distinct: ['takerPays', 'takerGets']
	})

	for(let book of books){
		update({ ctx, book })
	}
}

export function update({ ctx, book, subjects }){
	if(subjects){
		for(let subject of Object.values(subjects)){
			if(subject.type !== 'Book')
				continue

			update({ ctx, book: subject.book })
		}

		return
	}

	if(book){
		/*let makerBalance = readBalance({
			ctx,

		})*/
	}
}