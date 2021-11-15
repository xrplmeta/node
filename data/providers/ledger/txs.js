import { BaseProvider } from '../base.js'
import { rippleToUnix } from '../../../common/time.js'
import { deriveExchanges } from '../../../common/xrpl.js'


export default class extends BaseProvider{
	constructor({repo, nodes, config}){
		super('ledger.txs')

		this.repo = repo
		this.nodes = nodes
		this.busy = []
		this.config = config.ledger
	}

	async run(){
		let num = this.config.txsConcurrency || 1

		for(let i=0; i<num; i++){
			this.loop()
		}
	}

	async loop(){
		while(true){
			try{
				let currentLedger = await this.nodes.getCurrentLedger()
				let i = currentLedger.ledger_index

				while(i --> 0){
					if(this.busy.includes(i))
						continue

					if(await this.repo.operations.hasCompleted(`ledger.txs`, `l${i}`))
						continue

					if(await this.repo.operations.hasCompleted(`ledger.live`, `l${i}`))
						continue

					this.busy.push(i)

					await this.repo.operations.record('ledger.txs', `l${i}`, this.sift(i))

					this.busy = this.busy.filter(ledger => ledger !== i)
					break
				}
			}catch(e){
				this.log(`failed to obtain ledger: ${e.message}`)
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

		this.log(`found ${exchanges.length} exchanges (${ledger.close_time_human})`)

		await this.repo.exchanges.insert(exchanges.map(exchange => ({
			...exchange,
			date: rippleToUnix(ledger.close_time)
		})))
	}
}
