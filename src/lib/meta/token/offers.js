import { eq } from '@xrplkit/xfl'
import { write as writeRanked, read as readRanked } from '../ranked.js'

export function write({ ctx, book, ledgerIndex, offers }){
	writeRanked({
		ctx,
		table: 'tokenOffers',
		where: {
			...book
		},
		include: {
			takerGets: true,
			takerPays: true
		},
		ledgerIndex,
		items: offers.map(
			offer => ({ ...offer, ...book })
		),
		compare: {
			unique: (a, b) => eq(a.quality, b.quality),
			diff: (a, b) => eq(a.size, b.size)
		},
		rankBy: 'quality'
	})
}

export function read({ ctx, book, ledgerIndex }){
	return readRanked({
		ctx,
		table: 'tokenOffers',
		where: {
			...book
		},
		include: {
			takerGets: true,
			takerPays: true
		},
		ledgerIndex
	})
}