import { div } from '@xrplkit/xfl'


export function readTokenExchangeAligned({ ctx, base, quote, ledgerSequence }){
	let exchange = ctx.db.tokenExchanges.readOne({
		where: {
			OR: [
				{
					takerPaidToken: base,
					takerGotToken: quote
				},
				{
					takerPaidToken: quote,
					takerGotToken: base
				}
			],
			ledgerSequence: {
				lessOrEqual: ledgerSequence
			}
		},
		orderBy: {
			ledgerSequence: 'desc'
		}
	})

	if(!exchange)
		return

	return alignTokenExchange({ base, quote, exchange })
}

export function alignTokenExchange({ base, quote, exchange }){
	let { takerPaidToken, takerGotToken, takerPaidValue, takerGotValue, ...props } = exchange

	if(
		takerPaidToken.currency === base.currency && 
		takerPaidToken.issuer?.address === base.issuer?.address
	){
		return {
			...props,
			price: div(takerGotValue, takerPaidValue),
			volume: takerPaidValue
		}
	}else{
		return {
			...props,
			price: div(takerPaidValue, takerGotValue),
			volume: takerGotValue
		}
	}
}