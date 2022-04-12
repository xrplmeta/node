import { Snapshot } from '../../database/clients.js'
import accountExtensions from './account.js'
import log from '../../lib/log.js'


export default class extends Snapshot{
	constructor(file){
		super({file})
		this.extend({
			account: accountExtensions
		})
	}

	async isComplete(){
		return await this.snapshotHistory.count() === 0
	}

	async getCaptureRestoration(){
		let latestHistory = await this.snapshotHistory.findFirst({take: -1})

		if(!latestHistory)
			return

		if(!latestHistory.captureRestoration)
			return

		return {
			...JSON.parse(latestHistory.captureRestoration),
			ledgerIndex: latestHistory.ledgerIndex
		}
	}

	async add(ledgerObject){
		switch(ledgerObject.LedgerEntryType){
			case 'AccountRoot': 
				return await this.account.add(ledgerObject)
				

			case 'RippleState': 
				//this.addRippleState(ledgerObject)
				return

			case 'Offer': 
				//this.addCurrencyOffer(ledgerObject)
				return
		}
	}

	async addAccount(accountRoot){
		this.account.create({
			data: {
				address: Buffer.from(accountRoot.Account, 'hex'),
				emailHash: Buffer.from(accountRoot.EmailHash, 'hex'),
				domain: Buffer.from(accountRoot.Domain, 'hex'),
			}
		})
	
		snapshot.balances.insert({
			account: state.Account,
			token: null,
			balance: new Decimal(state.Balance)
				.div('1000000')
				.toString()
		})
	}

	async addRippleState(accountRoot){
		let currency = decodeCurrency(state.HighLimit.currency)
		let issuer = state.HighLimit.value === '0' ? state.HighLimit.issuer : state.LowLimit.issuer
		let holder = state.HighLimit.value !== '0' ? state.HighLimit.issuer : state.LowLimit.issuer

		snapshot.balances.insert({
			account: holder,
			token: {currency, issuer},
			balance: state.Balance.value.replace(/^-/, '')
		})
	}

	async addCurrencyOffer(accountRoot){
		let base
		let quote
		let gets
		let pays

		if(typeof state.TakerGets === 'string'){
			base = null
			gets = new Decimal(state.TakerGets)
				.div('1000000')
				.toString()
		}else{
			base = {
				currency: decodeCurrency(state.TakerGets.currency),
				issuer: state.TakerGets.issuer
			}
			gets = state.TakerGets.value
		}

		if(typeof state.TakerPays === 'string'){
			quote = null
			pays = new Decimal(state.TakerPays)
				.div('1000000')
				.toString()
		}else{
			quote = {
				currency: decodeCurrency(state.TakerPays.currency),
				issuer: state.TakerPays.issuer
			}
			pays = state.TakerPays.value
		}

		snapshot.tokenOffers.insert({
			account: state.Account,
			base,
			quote,
			gets,
			pays
		})
	}
}