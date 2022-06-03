import log from '@mwni/log'
import { extractExchanges } from '@xrplkit/txmeta'


export async function extract({ ledger, meta }){
	let exchanges = []

	for(let transaction of ledger.transactions){
		exchanges.push(...extractExchanges(transaction))
	}

	if(exchanges.length === 0)
		return

	await meta.tx(async () => {
		for(let exchange of exchanges){
			let takerPaidToken
			let takerGotToken

			if(exchange.takerPaid.issuer){
				takerPaidToken = {
					currency: { 
						code: exchange.takerPaid.currency 
					},
					issuer: { 
						address: exchange.takerPaid.issuer 
					}
				}
			}

			if(exchange.takerGot.issuer){
				takerGotToken = {
					currency: { 
						code: exchange.takerGot.currency 
					},
					issuer: { 
						address: exchange.takerGot.issuer 
					}
				}
			}

			await meta.tokenExchanges.createOne({
				data: {
					txHash: exchange.hash,
					ledgerIndex: ledger.index,
					taker: {
						address: exchange.taker
					},
					maker: {
						address: exchange.maker
					},
					sequence: exchange.sequence,
					takerPaidToken,
					takerGotToken,
					takerPaidValue: exchange.takerPaid.value,
					takerGotValue: exchange.takerGot.value,
				}
			})
		}
	})

	log.accumulate.info({
		line: [`recorded %tokenExchanges exchanges in %time`],
		tokenExchanges: exchanges.length
	})
}