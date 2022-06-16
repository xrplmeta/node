import { eq } from '@xrplkit/xfl'
import { write as writeRanked, read as readRanked } from '../ranked.js'

export function write({ ctx, token, ledgerIndex, whales }){
	writeRanked({
		ctx,
		table: 'tokenWhales',
		where: {
			token
		},
		include: {
			account: true
		},
		ledgerIndex,
		items: whales.map(
			whale => ({ ...whale, token })
		),
		compare: {
			unique: (a, b) => a.account.address === b.account.address,
			diff: (a, b) => eq(a.balance, b.balance)
		},
		rankBy: 'balance'
	})
}

export function read({ ctx, token, ledgerIndex }){
	return readRanked({
		ctx,
		table: 'tokenWhales',
		where: {
			token
		},
		include: {
			account: true
		},
		ledgerIndex
	})
}