import { mul } from '@xrplkit/xfl'
import { read as readMetrics, write as writeMetrics } from '../../lib/meta/token/metrics.js'
import { read as readExchange } from '../../lib/meta/token/exchanges.js'


export function update({ ctx, ledger, subjects }){
	for(let subject of Object.values(subjects)){
		if(subject.type !== 'Token')
			continue

		let { supply } = readMetrics({
			ctx,
			token: subject.token,
			ledgerSequence: ledger.sequence,
			metrics: {
				supply: true
			}
		})

		let exchange = readExchange({
			ctx,
			base: subject.token,
			quote: { currency: 'XRP' },
			ledgerSequence: ledger.sequence
		})

		let marketcap = 0

		if(supply && exchange){
			marketcap = mul(supply, exchange.price)
		}

		writeMetrics({
			ctx,
			token: subject.token,
			ledgerSequence: ledger.sequence,
			metrics: {
				marketcap
			}
		})
	}
}