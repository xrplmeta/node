import { BaseProvider } from '../base.js'
import { log } from '@xrplmeta/common/lib/log.js'
import { rippleToUnix, unixNow } from '@xrplmeta/common/lib/time.js'
import { deriveExchanges } from '@xrplmeta/common/lib/xrpl.js'
import { fromTxs as summarize } from '../../ledger/summary.js'

export default ({repo, config, xrpl, loopLedgerTask}) => {
	let open = null
	let commit = () => {
		let exchanges = []

		for(let tx of open.txs){
			if(tx.engine_result !== 'tesSUCCESS')
				continue

			if(['OfferCreate', 'Payment'].includes(tx.transaction.TransactionType)){
				try{
					exchanges.push(...deriveExchanges(tx))
				}catch(e){
					log.info(`failed to parse exchanges:\n`, e)
					continue
				}
			}
		}

		try{
			repo.exchanges.insert(exchanges.map(exchange => ({...exchange, date: open.time})))
			repo.ledgers.insert({index: open.index, date: open.time, ...summarize(open.txs)})
			repo.coverages.extend('ledger.txs', open.index)

			log.info(`recorded ${exchanges.length} exchange(s)`)
		}catch(e){
			log.info(`failed to record ${exchanges.length} exchange(s):\n`, e)
		}
		
		open = null
	}

	xrpl.on('ledger', ledger => {
		if(open){
			log.info(`ledger #${open.index} was incomplete (${open.txs.length} txs gone to waste)`)
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