import { eq } from '@xrplkit/xfl'
import { write as writeRanked, read as readRanked } from '../ranked.js'

export function write({ ctx, book, ledgerSequence, offers }){
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
		ledgerSequence,
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

export function read({ ctx, book, ledgerSequence }){
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
		ledgerSequence
	})
}