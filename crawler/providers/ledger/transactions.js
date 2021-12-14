import { log } from '@xrplmeta/common/lib/log.js'
import { wait, rippleToUnix } from '@xrplmeta/common/lib/time.js'
import { deriveExchanges } from '@xrplmeta/common/lib/xrpl.js'
import { fromTxs as summarize } from '../../ledger/summary.js'

export default ({repo, config, xrpl, loopLedgerTask, count}) => {
	loopLedgerTask(
		{
			task: 'ledgertx',
			interval: 1,
			backfillLedgers: config.ledger.stateTxLedgers,
			backfillInterval: 1
		},
		async index => {
			log.debug(`scanning transactions of ledger #${index}`)

			let exchanges = []
			let { ledger } = await xrpl.request({
				command: 'ledger',
				ledger_index: index,
				transactions: true,
				expand: true
			})
			let date = rippleToUnix(ledger.close_time)

			for(let tx of ledger.transactions){
				if(tx.metaData.TransactionResult !== 'tesSUCCESS')
					continue

				if(['OfferCreate', 'Payment'].includes(tx.TransactionType)){
					try{
						exchanges.push(...deriveExchanges(tx))
					}catch(e){
						log.info(`failed to parse exchanges:\n`, e)
						continue
					}
				}
			}


			repo.exchanges.insert(exchanges.map(exchange => ({...exchange, ledger: index})))
			repo.ledgers.insert({index, date, ...summarize(ledger.transactions)})

			count(`saved % exchange(s)`, exchanges.length, `(${ledger.close_time_human.slice(0, 20)})`)
		}
	)
}