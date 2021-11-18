import { BaseProvider } from '../base.js'
import { log } from '../../lib/log.js'
import { rippleToUnix, unixNow } from '../../../common/time.js'
import { deriveExchanges } from '../../../common/xrpl.js'


export default class extends BaseProvider{
	constructor({repo, xrpl, config}){
		super()

		this.repo = repo
		this.xrpl = xrpl
		this.config = config.ledger
		this.numExchanges = 0
		this.currentLedger = {}
	}

	run(){
		this.xrpl.on('ledger', ledger => {
			this.currentLedger = {
				index: ledger.ledger_index,
				expecting: ledger.txn_count,
				time: unixNow()
			}

			if(this.numExchanges > 0){
				log.info(`${this.numExchanges} new exchange(s)`)
				this.numExchanges = 0
			}
		})

		this.xrpl.on('transaction', tx => {
			this.currentLedger.expecting--

			if(this.currentLedger.expecting === 0){
				this.repo.operations.mark(
					'ledger.txs', 
					`l${this.currentLedger.index}`, 
					this.currentLedger.time, 
					'success'
				)
			}

			if(tx.engine_result !== 'tesSUCCESS')
				return

			if(['OfferCreate', 'Payment'].includes(tx.transaction.TransactionType)){
				try{
					var exchanges = deriveExchanges(tx)
				}catch{
					return
				}

				if(exchanges.length === 0)
					return

				this.numExchanges += exchanges.length

				this.repo.exchanges.insert(exchanges.map(exchange => ({
					...exchange,
					date: rippleToUnix(tx.transaction.date)
				})))
			}
		})
	}
}