import { eq } from '@xrplkit/xfl'
import { write as writeRanked, read as readRanked } from '../ranked.js'

export function write({ ctx, token, ledgerSequence, whales }){
	writeRanked({
		ctx,
		table: 'tokenWhales',
		where: {
			token
		},
		include: {
			account: true
		},
		ledgerSequence,
		items: whales.map(
			whale => ({ ...whale, token })
		),
		compare: {
			unique: (a, b) => a.account.address === b.account.address,
			diff: (a, b) => true
		},
		rankBy: 'balance'
	})
}

export function read({ ctx, token, ledgerSequence }){
	return readRanked({
		ctx,
		table: 'tokenWhales',
		where: {
			token
		},
		include: {
			account: true
		},
		ledgerSequence
	})
}