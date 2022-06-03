import { div, lt, gt, neg, max } from '@xrplkit/xfl'
import { fromRippled as fromRippledAmount } from '@xrplkit/amount'
import { rippleToUnix } from '@xrplkit/time'
import { encodeAccountID } from 'ripple-address-codec'


export async function add({ state, entry }){
	switch(entry.LedgerEntryType){
		case 'AccountRoot': 
			return await addAccountRoot({ state, entry })
			
		case 'RippleState': 
			return await addRippleState({ state, entry })

		case 'Offer': 
			return await addCurrencyOffer({ state, entry })

		case 'NFTokenPage':
			return await addNFTokenPage({ state, entry })

		case 'NFTokenOffer':
			return await addNFTokenOffer({ state, entry })
	}
}

export async function remove({ state, entry }){
	switch(entry.LedgerEntryType){
		case 'AccountRoot': 
			return await removeAccountRoot({ state, entry })
			
		case 'RippleState': 
			return await removeRippleState({ state, entry })

		case 'Offer': 
			return await removeCurrencyOffer({ state, entry })

		case 'NFTokenPage':
			return await removeNFTokenPage({ state, entry })

		case 'NFTokenOffer':
			return await removeNFTokenOffer({ state, entry })
	}
}

async function addAccountRoot({ state, entry }){
	await state.accounts.createOne({
		data: {
			address: entry.Account,
			emailHash: entry.EmailHash,
			domain: entry.Domain,
			balance: div(entry.Balance, '1000000'),
			lastModifiedIndex: entry.lastModifiedIndex,
			deleted: false
		}
	})
}

async function addRippleState({ state, entry }){
	let lowIssuer = entry.HighLimit.value !== '0' || lt(entry.Balance.value, '0')
	let highIssuer = entry.LowLimit.value !== '0' || gt(entry.Balance.value, '0')

	if(lowIssuer){
		await state.trustlines.createOne({
			data: {
				currency: { code: entry.Balance.currency },
				issuer: { address: entry.LowLimit.issuer },
				holder: { address: entry.HighLimit.issuer },
				balance: max(0, neg(entry.Balance.value)),
				lastModifiedIndex: entry.lastModifiedIndex,
				deleted: false
			}
		})
	}

	if(highIssuer){
		await state.trustlines.createOne({
			data: {
				currency: { code: entry.Balance.currency },
				issuer: { address: entry.HighLimit.issuer },
				holder: { address: entry.LowLimit.issuer },
				balance: max(0, entry.Balance.value),
				lastModifiedIndex: entry.lastModifiedIndex,
				deleted: false
			}
		})
	}
}

async function addCurrencyOffer({ state, entry }){
	let takerPays = fromRippledAmount(entry.TakerPays)
	let takerGets = fromRippledAmount(entry.TakerGets)

	await state.currencyOffers.createOne({
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
				: null,
			lastModifiedIndex: entry.lastModifiedIndex,
			deleted: false
		}
	})
}

async function addNFTokenPage({ state, entry }){
	let address = encodeAccountID(Buffer.from(entry.index.slice(0, 40), 'hex'))

	for(let { NFToken } of entry.NFTokens){
		let issuer = encodeAccountID(Buffer.from(NFToken.NFTokenID.slice(8, 48), 'hex'))

		await state.nfTokens.createOne({
			data: {
				owner: { address },
				issuer: { address: issuer },
				tokenId: NFToken.NFTokenID,
				uri: NFToken.URI,
				lastModifiedIndex: entry.lastModifiedIndex,
				deleted: false
			}
		})
	}
}

async function addNFTokenOffer({ state, entry }){
	let amount = fromRippledAmount(entry.Amount)

	await state.nfTokenOffers.createOne({
		data: {
			account: { address: entry.Owner },
			offerId: entry.index,
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
			buy: entry.Flags & 0x00000001,
			lastModifiedIndex: entry.lastModifiedIndex, 
			deleted: false
		}
	})
}



async function removeAccountRoot({ state, entry }){
	await state.accounts.createOne({
		data: {
			address: entry.Account,
			lastModifiedIndex: entry.lastModifiedIndex,
			deleted: true
		}
	})
}

async function removeRippleState({ state, entry }){
	let lowIssuer = entry.HighLimit.value !== '0' || lt(entry.Balance.value, '0')
	let highIssuer = entry.LowLimit.value !== '0' || gt(entry.Balance.value, '0')

	if(lowIssuer){
		await state.trustlines.createOne({
			data: {
				currency: { code: entry.Balance.currency },
				issuer: { address: entry.LowLimit.issuer },
				holder: { address: entry.HighLimit.issuer },
				lastModifiedIndex: entry.lastModifiedIndex,
				deleted: true
			}
		})
	}

	if(highIssuer){
		await state.trustlines.createOne({
			data: {
				currency: { code: entry.Balance.currency },
				issuer: { address: entry.HighLimit.issuer },
				holder: { address: entry.LowLimit.issuer },
				lastModifiedIndex: entry.lastModifiedIndex,
				deleted: true
			}
		})
	}
}

async function removeCurrencyOffer({ state, entry }){
	await state.currencyOffers.createOne({
		data: {
			account: { address: entry.Account },
			sequence: entry.Sequence,
			lastModifiedIndex: entry.lastModifiedIndex,
			deleted: true
		}
	})
}

async function removeNFTokenPage({ state, entry }){
	for(let { NFToken } of entry.NFTokens){
		await state.nfTokens.createOne({
			data: {
				tokenId: NFToken.NFTokenID,
				lastModifiedIndex: entry.lastModifiedIndex,
				deleted: true
			}
		})
	}
}

async function removeNFTokenOffer({ state, entry }){
	await state.nfTokenOffers.createOne({
		data: {
			account: { address: entry.Owner },
			sequence: entry.Sequence,
			lastModifiedIndex: entry.lastModifiedIndex,
			deleted: true
		}
	})
}