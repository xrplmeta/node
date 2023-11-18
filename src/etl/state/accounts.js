import { div } from '@xrplkit/xfl'
import { isBlackholed } from '../../xrpl/blackhole.js'
import { writeBalance } from '../../db/helpers/balances.js'
import { updateCacheForAccountProps } from '../../cache/tokens.js'


export function parse({ entry }){
	return {
		address: entry.Account,
		emailHash: entry.EmailHash,
		balance: div(entry.Balance, '1000000'),
		transferRate: entry.TransferRate,
		blackholed: isBlackholed(entry),
		domain: entry.Domain
			? Buffer.from(entry.Domain, 'hex').toString()
			: undefined,
	}
}

export function diff({ ctx, previous, final }){
	let address = final?.address || previous?.address

	if(final){
		let { balance, ...meta } = final
		var { id } = ctx.db.core.accounts.createOne({ 
			data: ctx.backwards
				? { address }
				: meta
		})

		if(final?.Domain != previous?.Domain)
			updateCacheForAccountProps({ ctx, account: final })
	}else{
		var { id } = ctx.db.core.accounts.createOne({ 
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