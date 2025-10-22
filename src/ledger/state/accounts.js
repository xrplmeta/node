import { div } from '@xrplkit/xfl'
import { isBlackholed } from '../../xrpl/blackhole.js'
import { writeBalance } from '../../db/helpers/balances.js'
import { markCacheDirtyForAccountProps } from '../../cache/todo.js'
import TokenType from '../../xrpl/tokentype.js'


export function parse({ entry }){
	return {
		address: entry.Account,
		balance: div(entry.Balance, '1000000'),
		ledgerSequence: entry.LedgerSequence,
		emailHash: entry.EmailHash,
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
		let { balance, ledgerSequence, ...meta } = final
		var { id } = ctx.db.core.accounts.createOne({ 
			data: ctx.backwards
				? { address }
				: meta
		})

		if(final?.Domain != previous?.Domain)
			markCacheDirtyForAccountProps({ ctx, account: final })
	}else{
		var { id } = ctx.db.core.accounts.createOne({ 
			data: {
				address
			}
		})
	}

	if(ctx.backwards && !previous){
		// edge case when backfilling AccountRoot deletions
		writeBalance({
			ctx,
			account: { id },
			token: {
				currency: 'XRP',
				issuer: null,
				tokenType: TokenType.XRP
			},
			ledgerSequence: ctx.ledgerSequence,
			balance: '0',
		})
	}

	if(final){
		writeBalance({
			ctx,
			account: { id },
			token: {
				currency: 'XRP',
				issuer: null,
				tokenType: TokenType.XRP
			},
			ledgerSequence: final.ledgerSequence,
			balance: final.balance,
		})
	}else{
		writeBalance({
			ctx,
			account: { id },
			token: {
				currency: 'XRP',
				issuer: null,
				tokenType: TokenType.XRP
			},
			ledgerSequence: ctx.ledgerSequence,
			balance: '0',
		})
	}
}