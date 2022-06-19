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
			({ balance, ...whale }) => ({ ...whale, token })
		),
		compare: {
			unique: (a, b) => a.account.address === b.account.address,
			diff: (a, b) => true
		}
	})
}

export function read({ ctx, token, ledgerSequence }){
	let whales = readRanked({
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

	if(whales.length === 0)
		return []

	let balances = ctx.meta.accountBalances.readMany({
		where: {
			token: { 
				id: token.id
			},
			account: {
				id: {
					in: whales.map(
						whale => whale.account.id
					)
				}
			}
		}
	})

	return whales.map(
		whale => ({
			...whale,
			balance: balances.find(
				balance => balance.account.id === whale.account.id
			).balance
		})
	)
}