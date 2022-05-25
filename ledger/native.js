import { div, lt, gt } from '@xrplkit/xfl'
import { fromRippled as fromRippledAmount } from '@xrplkit/amount'
import { rippleToUnix } from '@xrplkit/time'
import { encodeAccountID } from 'ripple-address-codec'


export async function addNativeEntry({ ledger, entry }){
	switch(entry.LedgerEntryType){
		case 'AccountRoot': 
			return await addAccountRoot({ ledger, entry })
			
		case 'RippleState': 
			return await addRippleState({ ledger, entry })

		case 'Offer': 
			return await addCurrencyOffer({ ledger, entry })

		case 'NFTokenPage':
			return await addNFTokenPage({ ledger, entry })

		case 'NFTokenOffer':
			return await addNFTokenOffer({ ledger, entry })
	}
}


async function addAccountRoot({ ledger, entry }){
	await ledger.accounts.createOne({
		data: {
			address: entry.Account,
			emailHash: entry.EmailHash,
			domain: entry.Domain,
			balance: div(entry.Balance, '1000000'),
		}
	})
}

async function addRippleState({ ledger, entry }){
	let lowIssuer = entry.HighLimit.value !== '0' || lt(entry.Balance.value, '0')
	let highIssuer = entry.LowLimit.value !== '0' || gt(entry.Balance.value, '0')

	await ledger.rippleStates.createOne({
		data: {
			currency: { code: entry.Balance.currency },
			lowAccount: { address: entry.LowLimit.issuer },
			highAccount: { address: entry.HighLimit.issuer },
			balance: entry.Balance.value,
			lowIssuer,
			highIssuer
		}
	})
}

async function addCurrencyOffer({ ledger, entry }){
	let takerPays = fromRippledAmount(entry.TakerPays)
	let takerGets = fromRippledAmount(entry.TakerGets)

	await ledger.currencyOffers.createOne({
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

async function addNFTokenPage({ ledger, entry }){
	let address = encodeAccountID(Buffer.from(entry.index.slice(0, 40), 'hex'))

	for(let { NFToken } of entry.NFTokens){
		let issuer = encodeAccountID(Buffer.from(NFToken.NFTokenID.slice(8, 48), 'hex'))

		await ledger.nfTokens.createOne({
			data: {
				owner: { address },
				issuer: { address: issuer },
				tokenId: NFToken.NFTokenID,
				uri: NFToken.URI
			}
		})
	}
}

async function addNFTokenOffer({ ledger, entry }){
	let amount = fromRippledAmount(entry.Amount)

	await ledger.nfTokenOffers.createOne({
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