import { Client } from '@structdb/sqlite'
import { fromRippled as fromRippledAmount } from '@xrplworks/amount'
import { rippleToUnix } from '@xrplworks/time'
import XFL from '@xrplworks/xfl'
import { encodeAccountID } from 'ripple-address-codec'
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
				return await this.addAccountRoot(entry)
				
			case 'RippleState': 
				return await this.addRippleState(entry)

			case 'Offer': 
				return await this.addCurrencyOffer(entry)

			case 'NFTokenPage':
				return await this.addNFTokenPage(entry)

			case 'NFTokenOffer':
				return await this.addNFTokenOffer(entry)
		}
	}

	async addAccountRoot(entry){
		await this.accounts.createOne({
			data: {
				address: entry.Account,
				emailHash: entry.EmailHash,
				domain: entry.Domain,
				balance: new XFL(entry.Balance)
					.div('1000000')
					.toString(),
			}
		})
	}

	async addRippleState(entry){
		await this.rippleStates.createOne({
			data: {
				currency: { code: entry.Balance.currency },
				lowAccount: { address: entry.LowLimit.issuer },
				highAccount: { address: entry.HighLimit.issuer },
				balance: entry.Balance.value
			}
		})
	}

	async addCurrencyOffer(entry){
		let takerPays = fromRippledAmount(entry.TakerPays)
		let takerGets = fromRippledAmount(entry.TakerGets)

		await this.currencyOffers.createOne({
			data: {
				account: { address: entry.Account },
				takerPaysCurrency: { code: takerPays.currency },
				takerPaysIssuer: takerPays.issuer 
					? { address: takerPays.issuer } 
					: null,
				takerPaysValue: takerPays.value,
				takerGetsCurrency: { code: takerGets.currency },
				takerGetsIssuer: takerGets.issuer
					? { address: takerGets.issuer }
					: null,
				takerGetsValue: takerGets.value,
				sequence: entry.Sequence,
				expiration: entry.Expiration
					? rippleToUnix(entry.Expiration)
					: null
			}
		})
	}

	async addNFTokenPage(entry){
		let address = encodeAccountID(Buffer.from(entry.index.slice(0, 40), 'hex'))

		for(let { NFToken } of entry.NFTokens){
			let issuer = encodeAccountID(Buffer.from(NFToken.NFTokenID.slice(8, 48), 'hex'))

			await this.nfTokens.createOne({
				data: {
					owner: { address },
					issuer: { address: issuer },
					tokenId: NFToken.NFTokenID,
					uri: NFToken.URI
				}
			})
		}
	}

	async addNFTokenOffer(entry){

	}
}