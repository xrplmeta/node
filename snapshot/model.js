import { Client } from '@structdb/sqlite'
import XFL from '@xrplworks/xfl'
import schemas from '../schemas/index.js'

export default class Snapshot extends Client{
	constructor(file){
		super({ 
			file, 
			schema: schemas.snapshot,
			journalMode: 'WAL'
		})
	}

	async add(entry){
		switch(entry.LedgerEntryType){
			case 'AccountRoot': 
				return await this.accounts.createOne({
					data: {
						address: entry.Account,
						emailHash: entry.EmailHash,
						domain: entry.Domain,
						balance: new XFL(entry.Balance)
							.div('1000000')
							.toString(),
					}
				})
				
			case 'RippleState': 
				return await this.rippleStates.createOne({
					data: {
						currency: {
							code: entry.Balance.currency
						},
						lowAccount: {
							address: entry.LowLimit.issuer
						},
						highAccount: {
							address: entry.HighLimit.issuer
						},
						balance: entry.Balance.value
					}
				})

			case 'Offer': 
				//this.addCurrencyOffer(ledgerObject)
		}
	}
}