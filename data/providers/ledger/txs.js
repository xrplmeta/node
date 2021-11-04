import { BaseProvider } from '../base.js'
import { rippleToUnix } from '../../../common/time.js'
import { log, pretty } from '../../../common/logging.js'
import { deriveExchanges } from '../../../common/xrpl.js'


export default class extends BaseProvider{
	constructor({repo, nodes, config}){
		super('ledger.txs')

		this.repo = repo
		this.nodes = nodes
		this.config = config.ledger
	}

	async run(){
		while(true){
			let currentLedger = await this.nodes.getCurrentLedger()
			let i = currentLedger.ledger_index

			while(i --> 0){
				if(await this.repo.hasSuccessfulOperation(`ledger.txs`, `l${i}`))
					continue

				if(await this.repo.hasSuccessfulOperation(`ledger.live`, `l${i}`))
					continue

				await this.repo.recordOperation('ledger.txs', `l${i}`, this.sift(i))
				break
			}
		}
	}

	async sift(ledgerIndex){
		this.log(`sifting through ledger #${ledgerIndex}`)

		let exchanges = []
		let { ledger } = await this.nodes.request({
			command: 'ledger',
			ledger_index: ledgerIndex,
			transactions: true,
			expand: true
		})

		for(let tx of ledger.transactions){
			if(tx.metaData.TransactionResult !== 'tesSUCCESS')
				continue

			if(['OfferCreate', 'Payment'].includes(tx.TransactionType)){
				try{
					exchanges.push(...deriveExchanges(tx))
				}catch{
					continue
				}
			}
		}

		this.log(`found ${exchanges.length} exchanges`)

		await this.repo.insertExchanges(exchanges.map(exchange => ({
			...exchange,
			date: rippleToUnix(ledger.close_time)
		})))
	}
}
