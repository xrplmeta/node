import { extractExchanges } from '@xrplkit/txmeta'
import { markCacheDirtyForTokenExchanges } from '../../cache/todo.js'
import TokenType from '../../xrpl/tokentype.js'


export function applyTokenExchanges({ ctx, ledger }){
	let exchanges = []

	for(let transaction of ledger.transactions){
		exchanges.push(...extractExchanges(transaction))
	}

	if(exchanges.length === 0)
		return

	for(let { hash, sequence, maker, taker, takerPaid, takerGot } of exchanges){
		let takerPaidToken = {
			currency: takerPaid.currency,
			issuer: takerPaid.issuer
				? { address: takerPaid.issuer }
				: undefined,
			tokenType: takerPaid.currency === 'XRP' ? TokenType.XRP : TokenType.IOU
		}

		let takerGotToken = {
			currency: takerGot.currency,
			issuer: takerGot.issuer
				? { address: takerGot.issuer }
				: undefined,
			tokenType: takerPaid.currency === 'XRP' ? TokenType.XRP : TokenType.IOU
		}

		ctx.db.core.tokenExchanges.createOne({
			data: {
				txHash: hash,
				ledgerSequence: ledger.sequence,
				taker: {
					address: taker
				},
				maker: {
					address: maker
				},
				sequence,
				takerPaidToken,
				takerGotToken,
				takerPaidValue: takerPaid.value,
				takerGotValue: takerGot.value,
			}
		})
		
		markCacheDirtyForTokenExchanges({ ctx, token: takerPaidToken })
		markCacheDirtyForTokenExchanges({ ctx, token: takerGotToken })
	}
}