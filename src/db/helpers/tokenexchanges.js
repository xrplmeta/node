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
		},
		include: {
			takerPaidToken: true,
			takerGotToken: true
		}
	})

	if(!exchange)
		return

	return alignTokenExchange({ exchange, base, quote  })
}

export function alignTokenExchange({ exchange, base, quote }){
	let { takerPaidToken, takerGotToken, takerPaidValue, takerGotValue, ...props } = exchange

	if(
		base &&
		takerPaidToken.id === base.id ||
		(takerPaidToken.currency === base.currency && 
		takerPaidToken.issuer?.address === base.issuer?.address)
	){
		return {
			...props,
			price: div(takerGotValue, takerPaidValue),
			volume: takerPaidValue
		}
	}
	else if(
		quote &&
		takerPaidToken.id === quote.id ||
		(takerPaidToken.currency === quote.currency && 
		takerPaidToken.issuer?.address === quote.issuer?.address)
	)
	{
		return {
			...props,
			price: div(takerPaidValue, takerGotValue),
			volume: takerGotValue
		}
	}
	else
	{
		throw new Error(`cannot align exchange: base/quote does not match`)
	}
}