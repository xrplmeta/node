import { BaseProvider } from '../base.js'
import { wait, unixNow } from '../../../common/time.js'
import { log, pretty } from '../../../common/logging.js'
import Decimal from '../../../common/decimal.js'



export default class extends BaseProvider{
	constructor({repo, nodes, config}){
		super('ledger.exchange')

		this.repo = repo
		this.nodes = nodes
		this.config = config
	}

	async run(){
		while(true){
			await this.cycle()
		}
	}

	async cycle(){
		let trustlines = await this.repo.getTrustlines()
		let issuers = Array.from(new Set(trustlines.map(({issuer}) => issuer)))
		let processing = 0


		for(let issuer of issuers){
			while(processing >= 10){
				await wait(10)
			}

			this.sync(issuer)
				.then(() => processing--)

			processing++
		}
	}

	async sync(issuer){
		let span = await this.repo.getMostRecentCoverageSpan(issuer)

		if(!span){
			span = {
				tailDate: unixNow(),
				headDate: unixNow()
			}
		}else if(span.tailDate === 0){
			return
		}
			

		try{
			let minLedger

			if(span.tailTx){
				let tailTx = await this.nodes.request({
					command: 'tx',
					transaction: span.tailTx
				})

				minLedger = tailTx.ledger_index
			}

			var { transactions } = await this.nodes.request({
				command: 'account_tx',
				account: issuer,
				ledger_index_max: minLedger,
				limit: 10000,
			})
		}catch(error){
			this.log(`could not fetch transactions:`, error)
			return
		}

		console.log(transactions)

		if(transactions.length === 0){
			this.log(`reached end of history for ${currency}`)
			return
		}


		let newTailTx = transactions[transactions.length - 1]
		let exchanges = transactions
			.filter(tx => tx.outcome.balanceChanges[tx.address].length === 2)
			.map(tx => {
				let id = tx.id
				let balanceChanges = tx.outcome.balanceChanges[tx.address]
				let currencyChange = balanceChanges.find(change => change.currency !== 'XRP')
				let xrpChange = balanceChanges.find(change => change.currency === 'XRP')
				let currency = currencyChange.currency
				let date = Math.floor(Date.parse(tx.outcome.timestamp) / 1000)
				let currencyValue = Math.abs(parseFloat(currencyChange.value))
				let xrpValue = Math.abs(parseFloat(xrpChange.value))
				let price = xrpValue / currencyValue
				let volume = xrpValue
				let taker = tx.address
				let maker = Object.keys(tx.outcome.balanceChanges)
					.find(address => address !== taker && address !== issuer)

				return {tx: id, date, currency, price, volume, maker, taker}
			})

		//not sure
		exchanges.sort((a, b) => a.date - b.date)
		
		for(let asset of assets){
			let relevantExchanges = exchanges.filter(exchange => exchange.currency === asset.currency)

			for(let exchange of relevantExchanges){
				try{
					await this.repo.addExchange(asset, exchange)
				}catch(error){
					this.log(`failed to insert row for ${asset.currency}: ${error.message}`)
				}
			}
		}

		for(let asset of assets){
			this.repo.updateCoverage(asset, {
				headDate: span.headDate,
				headTx: span.headTx,
				tailDate: Date.parse(newTailTx.outcome.timestamp)/1000,
				tailTx: newTailTx.id
			})
		}

		this.log(`syncing ${assets.map(asset => asset.currency).join('/')}: got ${exchanges.length} at ${newTailTx.outcome.timestamp}`)
	}




	async workLookup(node){
		while(true){
			let job = this.lookupQueue.shift()

			if(!job){
				await wait(100)
				continue
			}

			try{
				if(!node.isConnected())
					await node.connect()

				job.resolve(await node.getTransactions(job.request.issuer, {
					excludeFailures: true,
					types: ['order'],
					limit: 1000,
					start: job.request.start
				}))
			}catch(error){
				job.reject(error)
			}
		}
	}
}