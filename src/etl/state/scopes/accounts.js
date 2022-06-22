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
	if(!ctx.inBackfill){
		ctx.db.accounts.createOne({ 
			data: final 
		})
	}

	writeBalance({
		ctx,
		account: final,
		token: {
			currency: 'XRP',
			issuer: null
		},
		ledgerSequence: ctx.ledgerSequence,
		balance: final
			? final.balance
			: '0'
	})

	ctx.affectedScope({
		account: final,
		change: 'balances'
	})
}