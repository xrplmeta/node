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
		let takerPaidToken = tokenFromExchange(takerPaid)
		let takerGotToken = tokenFromExchange(takerGot)

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

function tokenFromExchange(amount){
	if(amount.currency === 'XRP'){
		return {
			currency: 'XRP',
			tokenType: TokenType.XRP
		}
	}

	if(amount.mpt_issuance_id){
		return {
			mptIssuanceId: amount.mpt_issuance_id,
			tokenType: TokenType.MPT
		}
	}

	return {
		currency: amount.currency,
		issuer: amount.issuer
			? { address: amount.issuer }
			: undefined,
		tokenType: TokenType.IOU
	}
}
