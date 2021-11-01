import EventEmitter from 'events'
import { wait } from './utils.js'

export default class extends EventEmitter{
	constructor(node){
		super()

		this.node = node
		this.node.connection.on('ledgerClosed', ledger => this.emit('ledger', ledger))
		this.node.connection.on('transaction', event => this.emit('transaction', event.transaction))
		this.node.connection.on('transaction', event => {
			let exchange = this.deriveExchange(event)

			if(exchange)
				this.emit('exchange', exchange)
		})
	}

	async subscribe(trustlines){
		while(!this.node.isConnected()){
			await wait(250)
		}

		await this.node.request('subscribe', {
			accounts: trustlines.map(line => line.issuer),
			streams: ['ledger']
		})
	}

	deriveExchange(event){
		let gotten = []
		let paid = []
		let takers = []
		let orderNodes = event.meta.AffectedNodes
			.map(node => node.ModifiedNode || node.DeletedNode)
			.filter(node => node && node.LedgerEntryType === 'Offer')
		
		for(let node of orderNodes){
			if(!node.PreviousFields)
				continue

			this.accumulateOrderChanges(gotten, node.FinalFields.TakerGets, node.PreviousFields.TakerGets)
			this.accumulateOrderChanges(paid, node.FinalFields.TakerPays, node.PreviousFields.TakerPays)

			takers.push(node.FinalFields.Account)
		}

		if(gotten.length === 0 && paid.length === 0)
			return null

		if(gotten.length !== 1 || paid.length !== 1){
			//special exchange case not implemented, yet
			return null
		}

		let base = gotten[0]
		let quote = paid[0]

		return {
			tx: event.transaction.hash,
			date: 946684800 + event.transaction.date,
			price: quote.value / base.value,
			volume: base.value,
			base: {currency: base.currency, issuer: base.issuer},
			quote: {currency: quote.currency, issuer: quote.issuer},
			maker: event.transaction.Account,
			takers: takers
				.filter(taker => taker !== event.transaction.Account)
				.filter((taker, i, list) => list.indexOf(taker) === i)
		}
	}

	accumulateOrderChanges(accumulations, final, previous){
		final = this.normalizeAmount(final)
		previous = this.normalizeAmount(previous)

		let existing = accumulations.find(acc => acc.currency === final.currency)

		if(!existing){
			existing = {
				currency: final.currency,
				issuer: final.issuer,
				value: 0
			}

			accumulations.push(existing)
		}

		existing.value += previous.value - final.value
	}

	normalizeAmount(amount){
		if(typeof amount === 'string')
			return {
				currency: 'XRP', 
				issuer: null, 
				value: parseFloat(amount) / 1000000
			}
		else
			return {
				currency: amount.currency,
				issuer: amount.issuer,
				value: parseFloat(amount.value)
			}
	}
}