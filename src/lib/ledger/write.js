import { div, lt, gt, neg, max } from '@xrplkit/xfl'
import { fromRippled as fromRippledAmount } from '@xrplkit/amount'
import { rippleToUnix } from '@xrplkit/time'
import { encodeAccountID } from 'ripple-address-codec'
import { is as isBlackholed } from './blackhole.js'


export async function write({ state, entry, change }){
	switch(entry.LedgerEntryType){
		case 'AccountRoot': 
			return await setAccountRoot({ state, entry, change })
			
		case 'RippleState': 
			return await setRippleState({ state, entry, change })

		case 'Offer': 
			return await setCurrencyOffer({ state, entry, change })

		case 'NFTokenPage':
			return await setNFTokenPage({ state, entry, change })

		case 'NFTokenOffer':
			return await setNFTokenOffer({ state, entry, change })
	}
}

async function setAccountRoot({ state, entry, change }){
	await state.accounts.createOne({
		data: {
			address: entry.Account,
			emailHash: entry.EmailHash,
			domain: entry.Domain,
			balance: div(entry.Balance, '1000000'),
			transferRate: entry.transferRate,
			blackholed: isBlackholed(entry),
			change
		}
	})
}

async function setRippleState({ state, entry, change }){
	let lowIssuer = entry.HighLimit.value !== '0' || lt(entry.Balance.value, '0')
	let highIssuer = entry.LowLimit.value !== '0' || gt(entry.Balance.value, '0')

	if(lowIssuer){
		await state.trustlines.createOne({
			data: {
				currency: { code: entry.Balance.currency },
				issuer: { address: entry.LowLimit.issuer },
				holder: { address: entry.HighLimit.issuer },
				balance: max(0, neg(entry.Balance.value)),
				change
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
				change
			}
		})
	}
}

async function setCurrencyOffer({ state, entry, change }){
	let takerPays = fromRippledAmount(entry.TakerPays)
	let takerGets = fromRippledAmount(entry.TakerGets)

	await state.currencyOffers.createOne({
		data: {
			account: { address: entry.Account },
			directory: entry.DirectoryNode,
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
			change
		}
	})
}

async function setNFTokenPage({ state, entry, change }){
	let address = encodeAccountID(Buffer.from(entry.index.slice(0, 40), 'hex'))

	for(let { NFToken } of entry.NFTokens){
		let issuer = encodeAccountID(Buffer.from(NFToken.NFTokenID.slice(8, 48), 'hex'))

		await state.nfTokens.createOne({
			data: {
				owner: { address },
				issuer: { address: issuer },
				tokenId: NFToken.NFTokenID,
				uri: NFToken.URI,
				change
			}
		})
	}
}

async function setNFTokenOffer({ state, entry, change }){
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
			change
		}
	})
}