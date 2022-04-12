import { Snapshot } from '../../database/clients.js'
import accountExtensions from './account.js'
import rippleStateExtensions from './rippleState.js'
import log from '../../lib/log.js'


export default class extends Snapshot{
	constructor(file){
		super({file})
		this.extend({
			account: accountExtensions,
			rippleState: rippleStateExtensions
		})
	}

	async isComplete(){
		return await this.snapshotHistory.count() === 0
	}

	async getLatestHistory(){
		return await this.snapshotHistory.findFirst({take: -1})
	}

	async getCurrentEntriesCount(){
		let latestHistory = await this.getLatestHistory()

		if(!latestHistory)
			return

		return latestHistory.entriesCount
	}

	async getCaptureRestoration(){
		let latestHistory = await this.getLatestHistory()

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
				return await this.rippleState.add(ledgerObject)

			case 'Offer': 
				//this.addCurrencyOffer(ledgerObject)
		}
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