import { extractExchanges } from '@xrplworks/tx'
import { rippleToUnix } from '@xrplworks/time'
import log from '../../lib/log.js'
import { fromTxs as summarize } from '../../lib/summary.js'
import { scheduleLedgerRoutine } from '../routine.js'

export function willRun(){
	return true
}

export function run({ repo, config, xrpl }){
	scheduleLedgerRoutine({
		id: 'backfill',
		interval: {
			live: 1,
			backfill: 1
		},
		routine: async index => {
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
						exchanges.push(...extractExchanges(tx))
					}catch(e){
						log.info(`failed to parse exchanges:\n`, e)
						continue
					}
				}
			}

			repo.exchanges.insert(
				exchanges
					.map(exchange => ({...exchange, ledger: index}))
			)

			repo.ledgers.insert({
				index, 
				date, 
				...summarize(ledger.transactions)
			})

			return {
				[`discovered exchanges on ${ledger.close_time_human.slice(0, 11)}`]: exchanges.length
			}
		}
	})
}