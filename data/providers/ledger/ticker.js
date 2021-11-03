import ripple from 'ripple-lib'
import { wait, log, unixNow } from '../shared/utils.js'
import Observer from '../shared/observer.js'

export default class{
	constructor({repo, node}){
		this.repo = repo

		this.node = new ripple.RippleAPI({
			server: `wss://${node}`
		})
		this.node.on('connected', () => {
			this.log(`successfully connected to node ${node}`)
			this.observer.subscribe(this.repo.assets)
		})
		this.node.on('disconnected', code => {
			this.log(`disconnected from node (code ${code}) - reconnecting...`)
			this.node.connect()
		})
		

		this.observer = new Observer(this.node)
		this.observer.on('exchange', exchange => this.recordExchange(exchange))
		this.observer.on('ledger', ledger => this.updateHead(ledger))
		this.observer.on('transaction', tx => this.registerTransaction(tx))

		this.log = log.for({name: 'ticker', color: 'yellow'})
	}

	async start(){
		await this.node.connect()
	}

	async recordExchange(exchange){
		if(exchange.base.currency !== 'XRP' && exchange.quote.currency !== 'XRP'){
			//todo
			return
		}

		let asset
		let price
		let volume

		if(exchange.quote.currency === 'XRP'){
			asset = exchange.base
			price = exchange.price
			volume = exchange.volume * price
		}else{
			asset = exchange.quote
			price = 1 / exchange.price
			volume = exchange.volume
		}

		if(!this.repo.hasAsset(asset))
			return

		this.repo.addExchange(asset, {
			date: exchange.date,
			price, 
			volume, 
			tx: exchange.tx,
			maker: exchange.maker,
			taker: exchange.takers[0]
		})

		this.log(`recorded new exchange for ${asset.currency} (${price}XRP)`)
	}

	async updateHead(ledger){
		ledger = {...ledger, timestamp: unixNow()}

		if(this.firstTx && this.lastTx){
			this.repo.updateAllCoverageHeads({
				tailDate: ledger.timestamp - 5,
				tailTx: this.firstTx,
				headDate: ledger.timestamp,
				headTx: this.lastTx
			})
		}

		this.lastLedger = ledger
	}

	async registerTransaction(tx){
		this.lastTx = tx.hash

		if(!this.firstTx)
			this.firstTx = tx.hash
	}
}