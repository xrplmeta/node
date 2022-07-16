import { XFL, sum, div, gt } from '@xrplkit/xfl'



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
			price: gt(takerPaidValue, 0)
				? div(takerGotValue, takerPaidValue)
				: XFL(0),
			volume: takerGotValue
		}
	}
	else if(takerPaidIsQuote || takerGotIsBase)
	{
		return {
			...props,
			price: gt(takerGotValue, 0)
				? div(takerPaidValue, takerGotValue)
				: XFL(0),
			volume: takerPaidValue
		}
	}
	else
	{
		throw new Error(`cannot align exchange: base/quote does not match`)
	}
}



export function readTokenExchangeIntervalSeries({ ctx, base, quote, sequence, time }){
	if(time){
		var exchanges = ctx.db.tokenExchanges.readManyRaw({
			query: 
				`SELECT MAX(Ledger.closeTime) as time, takerPaidToken, takerGotToken, takerPaidValue, takerGotValue
				FROM TokenExchange
				LEFT JOIN Ledger ON (Ledger.sequence = ledgerSequence)
				WHERE (
						(takerPaidToken = ? AND takerGotToken = ?)
						OR
						(takerGotToken = ? AND takerPaidToken = ?)
					)
					AND 
					(
						(Ledger.closeTime >= ? AND Ledger.closeTime <= ?)
						OR
						(
							ledgerSequence = (
								SELECT ledgerSequence
								FROM TokenExchange
								WHERE (
										(takerPaidToken = ? AND takerGotToken = ?)
										OR
										(takerGotToken = ? AND takerPaidToken = ?)
									)
									AND ledgerSequence < ?
								ORDER BY ledgerSequence DESC
								LIMIT 1
							)
						)
					)
				GROUP BY Ledger.closeTime / CAST(? as INTEGER)
				ORDER BY Ledger.closeTime ASC`,
			params: [
				base.id,
				quote.id,
				quote.id,
				base.id,
				time.start,
				time.end,
				base.id,
				quote.id,
				quote.id,
				base.id,
				sequence.start,
				time.interval,
			]
		})
	}else{
		var exchanges = ctx.db.tokenExchanges.readManyRaw({
			query: 
				`SELECT MAX(ledgerSequence) as sequence, takerPaidToken, takerGotToken, takerPaidValue, takerGotValue
				FROM TokenExchange
				WHERE (
						(takerPaidToken = ? AND takerGotToken = ?)
						OR
						(takerGotToken = ? AND takerPaidToken = ?)
					)
					AND (
						(ledgerSequence >= ? AND ledgerSequence <= ?)
						OR
						(
							ledgerSequence = (
								SELECT ledgerSequence
								FROM TokenExchange
								WHERE (
										(takerPaidToken = ? AND takerGotToken = ?)
										OR
										(takerGotToken = ? AND takerPaidToken = ?)
									)
									AND ledgerSequence < ?
								ORDER BY ledgerSequence DESC
								LIMIT 1
							)
						)
					)
				GROUP BY ledgerSequence / CAST(? as INTEGER)
				ORDER BY ledgerSequence ASC`,
			params: [
				base.id,
				quote.id,
				quote.id,
				base.id,
				sequence.start,
				sequence.end,
				base.id,
				quote.id,
				quote.id,
				base.id,
				sequence.start,
				sequence.interval,
			]
		})
	}

	return exchanges.map(
		({ takerPaidToken, takerGotToken, takerPaidValue, takerGotValue, ...props }) => {
			if(takerPaidToken === base.id){
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
	)
}
