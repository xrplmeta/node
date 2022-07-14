import { XFL, sum, div } from '@xrplkit/xfl'


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
			takerPaidToken: {
				issuer: true
			},
			takerGotToken: {
				issuer: true
			}
		}
	})

	if(!exchange)
		return

	return alignTokenExchange({ exchange, base, quote  })
}

export function readTokenVolume({ ctx, base, quote, sequenceStart, sequenceEnd }){
	let volume = XFL(0)
	let iter = ctx.db.tokenExchanges.iter({
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
			AND: [
				{
					ledgerSequence: {
						greaterOrEqual: sequenceStart
					}
				},
				{
					ledgerSequence: {
						lessOrEqual: sequenceEnd
					}
				}
			]
		}
	})

	for(let exchange of iter){
		volume = sum(
			volume,
			alignTokenExchange({ exchange, base, quote }).volume
		)
	}

	return volume
}

export function alignTokenExchange({ exchange, base, quote }){
	let { takerPaidToken, takerGotToken, takerPaidValue, takerGotValue, ...props } = exchange
	let takerPaidIsBase = false
	let takerGotIsBase = false
	let takerPaidIsQuote = false
	let takerGotIsQuote = false

	if(base){
		takerPaidIsBase = (
			takerPaidToken.id === base.id
			|| (
				takerPaidToken.currency === base.currency
				&& takerPaidToken.issuer?.address === base.issuer?.address
			)
		)

		takerGotIsBase = (
			takerGotToken.id === base.id
			|| (
				takerGotToken.currency === base.currency
				&& takerGotToken.issuer?.address === base.issuer?.address
			)
		)
	}

	if(quote){
		takerPaidIsQuote = (
			takerPaidToken.id === quote.id
			|| (
				takerPaidToken.currency === quote.currency
				&& takerPaidToken.issuer?.address === quote.issuer?.address
			)
		)

		takerGotIsQuote = (
			takerGotToken.id === quote.id
			|| (
				takerGotToken.currency === quote.currency
				&& takerGotToken.issuer?.address === quote.issuer?.address
			)
		)
	}

	if(takerPaidIsBase || takerGotIsQuote){
		return {
			...props,
			price: div(takerGotValue, takerPaidValue),
			volume: takerGotValue
		}
	}
	else if(takerPaidIsQuote || takerGotIsBase)
	{
		return {
			...props,
			price: div(takerPaidValue, takerGotValue),
			volume: takerPaidValue
		}
	}
	else
	{
		throw new Error(`cannot align exchange: base/quote does not match`)
	}
}