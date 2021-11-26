import { BaseProvider } from '../base.js'
import { log } from '../../lib/log.js'
import { wait, rippleToUnix } from '../../../common/time.js'
import { deriveExchanges } from '../../../common/xrpl.js'


export default class extends BaseProvider{
	constructor({repo, xrpl, config}){
		super()

		this.repo = repo
		this.xrpl = xrpl
		this.busy = []
		this.config = config.ledger
		this.known = {head: 0, tail: Infinity}
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
				let result = await this.xrpl.request({command: 'ledger'})
				let currentLedger = result.ledger || result.closed.ledger
				let i = currentLedger.ledger_index

				while(i --> 0){
					if(this.busy.includes(i))
						continue

					if(i <= this.known.head && i>= this.known.tail)
						continue

					if(await this.repo.operations.hasCompleted(`ledger.txs`, `l${i}`)){
						this.know(i)
						continue
					}

					if(await this.repo.operations.hasCompleted(`ledger.live`, `l${i}`)){
						this.know(i)
						continue
					}

					this.busy.push(i)

					await this.repo.operations.record('ledger.txs', `l${i}`, this.sift(i))

					this.busy = this.busy.filter(ledger => ledger !== i)
					this.know(i)
					break
				}
			}catch(e){
				log.error(`failed to obtain ledger:`)
				log.error(e)

				await wait(10000)
			}
		}
	}

	async sift(ledgerIndex){
		log.debug(`sifting through ledger #${ledgerIndex}`)

		let exchanges = []
		let { ledger } = await this.xrpl.request({
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

		log.info(`found ${exchanges.length} exchanges (${ledger.close_time_human})`)

		await this.repo.exchanges.insert(exchanges.map(exchange => ({
			...exchange,
			date: rippleToUnix(ledger.close_time)
		})))
	}

	know(i){
		this.known.head = Math.max(this.known.head, i)
		this.known.tail = Math.min(this.known.tail, i)
	}
}
