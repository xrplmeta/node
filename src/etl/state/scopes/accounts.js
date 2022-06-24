import { div } from '@xrplkit/xfl'
import { isBlackholed } from '../../../xrpl/blackhole.js'
import { writeBalance } from '../../../db/helpers/balances.js'


export function parse({ entry }){
	return {
		address: entry.Account,
		emailHash: entry.EmailHash,
		balance: div(entry.Balance, '1000000'),
		transferRate: entry.transferRate,
		blackholed: isBlackholed(entry),
		domain: entry.domain
			? Buffer.from(entry.domain, 'hex').toString()
			: undefined,
	}
}

export function diff({ ctx, previous, final }){
	let address = final?.address || previous?.address

	if(final){
		let { balance, ...meta } = final
		var { id } = ctx.db.accounts.createOne({ 
			data: ctx.inBackfill
				? { address }
				: meta
		})
	}else{
		var { id } = ctx.db.accounts.createOne({ 
			data: {
				address
			}
		})
	}

	writeBalance({
		ctx,
		account: {
			id
		},
		token: {
			currency: 'XRP',
			issuer: null
		},
		ledgerSequence: ctx.ledgerSequence,
		balance: final
			? final.balance
			: '0'
	})
}