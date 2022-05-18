import fs from 'fs'
import { Client } from '@structdb/sqlite'
import { fromRippled as fromRippledAmount } from '@xrplworks/amount'
import { rippleToUnix } from '@xrplworks/time'
import XFL from '@xrplworks/xfl'
import { encodeAccountID } from 'ripple-address-codec'
import schemas from '../schemas/index.js'



export function init({ config, variant }){
	let db = new Client({
		file: getFilePath(variant),
		schema: schemas.snapshot,
		journalMode: 'WAL'
	})

	function getFilePath(variant){
		return `${config.data.dir}/ledger-${variant}.db`
	}

	async function addAccountRoot(entry){
		await db.accounts.createOne({
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

	async function addRippleState(entry){
		await db.rippleStates.createOne({
			data: {
				currency: { code: entry.Balance.currency },
				lowAccount: { address: entry.LowLimit.issuer },
				highAccount: { address: entry.HighLimit.issuer },
				balance: entry.Balance.value
			}
		})
	}

	async function addCurrencyOffer(entry){
		let takerPays = fromRippledAmount(entry.TakerPays)
		let takerGets = fromRippledAmount(entry.TakerGets)

		await db.currencyOffers.createOne({
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

	async function addNFTokenPage(entry){
		let address = encodeAccountID(Buffer.from(entry.index.slice(0, 40), 'hex'))

		for(let { NFToken } of entry.NFTokens){
			let issuer = encodeAccountID(Buffer.from(NFToken.NFTokenID.slice(8, 48), 'hex'))

			await db.nfTokens.createOne({
				data: {
					owner: { address },
					issuer: { address: issuer },
					tokenId: NFToken.NFTokenID,
					uri: NFToken.URI
				}
			})
		}
	}

	async function addNFTokenOffer(entry){
		let amount = fromRippledAmount(entry.Amount)

		await db.nfTokenOffers.createOne({
			data: {
				account: { address: entry.Owner },
				tokenId: entry.NFTokenID,
				amountCurrency: { code: amount.currency },
				amountIssuer: amount.issuer 
					? { address: amount.issuer } 
					: null,
				amountValue: amount.value,
				destination: entry.Destination
					? { address: entry.Destination }
					: null,
				expiration: entry.Expiration
					? rippleToUnix(entry.Expiration)
					: null,
				buy: entry.Flags & 0x00000001
			}
		})
	}


	return Object.assign(db, {
		async isIncomplete(){
			let latest = await db.journal.readOne({ last: true })
			return !latest || latest.captureMarker
		},

		async addNativeEntry(entry){
			switch(entry.LedgerEntryType){
				case 'AccountRoot': 
					return await addAccountRoot(entry)
					
				case 'RippleState': 
					return await addRippleState(entry)
	
				case 'Offer': 
					return await addCurrencyOffer(entry)
	
				case 'NFTokenPage':
					return await addNFTokenPage(entry)
	
				case 'NFTokenOffer':
					return await addNFTokenOffer(entry)
			}
		},

		async fork({ variant: forkedVariant }){
			db.compact()
			fs.copyFileSync(getFilePath(variant), getFilePath(forkedVariant))
		}
	})
}