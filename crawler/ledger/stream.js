import { extractExchanges } from '@xrplworks/tx'
import { rippleToUnix } from '@xrplworks/time'
import log from '../../lib/log.js'
import { fromTxs as summarize } from '../../lib/summary.js'
import { accumulate as accumulateUpdates } from '../../lib/status.js'

export function willRun(){
	return true
}

export function run({ repo, config, xrpl }){
	let open = null
	let commit = () => {
		let exchanges = []

		for(let tx of open.txs){
			if(tx.engine_result !== 'tesSUCCESS')
				continue

			if(['OfferCreate', 'Payment'].includes(tx.transaction.TransactionType)){
				try{
					exchanges.push(...extractExchanges(tx))
				}catch(e){
					log.info(`failed to parse exchanges:\n`, e)
					continue
				}
			}
		}

		try{
			repo.exchanges.insert(
				exchanges
					.map(exchange => ({...exchange, ledger: open.index}))
			)
			
			repo.ledgers.insert({
				index: open.index, 
				date: open.time, 
				...summarize(open.txs)
			})
			
			repo.coverages.extend('ledgertx', open.index)

			accumulateUpdates({'% exchange(s) recorded': exchanges.length})
		}catch(e){
			log.info(`failed to record ${exchanges.length} exchange(s):\n`, e)
		}
		
		open = null
	}

	xrpl.on('ledger', ledger => {
		if(open){
			log.info(`ledger #${open.index} was incomplete (${open.txs.length} tx gone to waste)`)
		}

		open = {
			index: ledger.ledger_index,
			expecting: ledger.txn_count,
			time: rippleToUnix(ledger.ledger_time),
			txs: []
		}
	})

	xrpl.on('transaction', tx => {
		if(!open)
			return

		open.txs.push(tx)

		if(open.txs.length >= open.expecting)
			commit()
	})
}