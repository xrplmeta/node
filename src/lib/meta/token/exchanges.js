import log from '@mwni/log'
import { extractExchanges } from '@xrplkit/txmeta'


export function extract({ ctx, ledger }){
	let subjects = {}
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
				: undefined
		}

		let takerGotToken = {
			currency: takerGot.currency,
			issuer: takerGot.issuer
				? { address: takerGot.issuer }
				: undefined
		}

		
		for(let token of [takerPaidToken, takerGotToken]){
			if(token.issuer)
				subjects = {
					...subjects,
					[`${token.currency}:${token.issuer.address}`]: {
						type: 'Token',
						token
					}
				}
		}

		ctx.meta.tokenExchanges.createOne({
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
	}

	log.accumulate.info({
		text: [
			`recorded %tokenExchanges exchanges in %time`
		],
		data: {
			tokenExchanges: exchanges.length
		}
	})

	return subjects
}