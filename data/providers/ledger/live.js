import { BaseProvider } from '../base.js'
import { rippleToUnix, unixNow } from '../../../common/time.js'
import { deriveExchanges } from '../../../common/xrpl.js'


export default class extends BaseProvider{
	constructor({repo, nodes, config}){
		super('ledger.live')

		this.repo = repo
		this.nodes = nodes
		this.config = config.ledger
	}

	run(){
		this.nodes.on('ledger', ledger => {
			this.currentLedger = {
				index: ledger.ledger_index,
				expecting: ledger.txn_count,
				time: unixNow()
			}

			
		})

		this.nodes.on('transaction', tx => {
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

				this.log(`${exchanges.length} new exchange(s)`)

				this.repo.exchanges.insert(exchanges.map(exchange => ({
					...exchange,
					date: rippleToUnix(tx.transaction.date)
				})))
			}
		})
	}
}