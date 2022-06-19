import { mul } from '@xrplkit/xfl'
import { read as readMetrics, write as writeMetrics } from '../../lib/meta/token/metrics.js'
import { read as readExchange } from '../../lib/meta/token/exchanges.js'


export function updateAll({ ctx }){
	let tokens = ctx.meta.tokens.iter()

	for(let token of tokens){
		update({ ctx, token })
	}
}

export function update({ ctx, token, subjects }){
	if(subjects){
		for(let subject of Object.values(subjects)){
			if(subject.type !== 'Token')
				continue

			update({ ctx, token: subject.token })
		}

		return
	}

	let { supply } = readMetrics({
		ctx,
		token,
		ledgerSequence: ctx.ledgerSequence,
		metrics: {
			supply: true
		}
	})

	let exchange = readExchange({
		ctx,
		base: token,
		quote: { currency: 'XRP' },
		ledgerSequence: ctx.ledgerSequence
	})

	let marketcap = 0

	if(supply && exchange){
		marketcap = mul(supply, exchange.price)
	}

	writeMetrics({
		ctx,
		token,
		ledgerSequence: ctx.ledgerSequence,
		metrics: {
			marketcap
		}
	})
}

