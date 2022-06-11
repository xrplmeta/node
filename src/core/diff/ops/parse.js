import { div, lt, gt, neg, max } from '@xrplkit/xfl'
import { fromRippled as fromRippledAmount } from '@xrplkit/amount'
import { rippleToUnix } from '@xrplkit/time'
import { encodeAccountID } from 'ripple-address-codec'
import { isBlackholed } from '../../../lib/xrpl/blackhole.js'


export function AccountRoot({ entry }){
	return {
		address: entry.Account,
		emailHash: entry.EmailHash,
		domain: entry.Domain,
		balance: div(entry.Balance, '1000000'),
		transferRate: entry.transferRate,
		blackholed: isBlackholed(entry)
	}
}

export function RippleState({ entry }){
	let lowIssuer = entry.HighLimit.value !== '0' || lt(entry.Balance.value, '0')
	let highIssuer = entry.LowLimit.value !== '0' || gt(entry.Balance.value, '0')
	let transformed = {}

	if(lowIssuer){
		transformed.low = {
			account: { 
				address: entry.HighLimit.issuer 
			},
			token: {
				currency: entry.Balance.currency,
				issuer: {
					address: entry.LowLimit.issuer
				}
			},
			balance: max(0, neg(entry.Balance.value))
		}
	}

	if(highIssuer){
		transformed.high = {
			account: { 
				address: entry.LowLimit.issuer 
			},
			token: {
				currency: entry.Balance.currency,
				issuer: {
					address: entry.HighLimit.issuer
				}
			},
			balance: max(0, entry.Balance.value)
		}
	}

	return transformed
}

export function CurrencyOffer({ entry }){
	let takerPays = fromRippledAmount(entry.TakerPays)
	let takerGets = fromRippledAmount(entry.TakerGets)

	return {
		account: { address: entry.Account },
		sequence: entry.Sequence,
		directory: entry.BookDirectory,
		takerPaysToken: takerPays.issuer
			? { currency: takerPays.currency, issuer: { address: takerPays.issuer }}
			: null,
		takerGetsToken: takerGets.issuer
			? { currency: takerGets.currency, issuer: { address: takerGets.issuer }}
			: null,
		takerPaysValue: takerPays.value,
		takerGetsValue: takerGets.value,
		expiration: entry.Expiration
			? rippleToUnix(entry.Expiration)
			: null
	}
}

export function NFTokenPage({ entry }){
	let address = encodeAccountID(Buffer.from(entry.index.slice(0, 40), 'hex'))
	let page = {
		account: { address },
		nfts: []
	}

	for(let { NFToken } of entry.NFTokens){
		let issuer = encodeAccountID(Buffer.from(NFToken.NFTokenID.slice(8, 48), 'hex'))

		page.nfts.push({
			account: { address },
			issuer: { address: issuer },
			tokenId: NFToken.NFTokenID,
			uri: NFToken.URI,
		})
	}

	return page
}

export function NFTokenOffer({ entry }){
	let amount = fromRippledAmount(entry.Amount)

	return {
		account: { address: entry.Owner },
		offerId: entry.index,
		tokenId: entry.NFTokenID,
		amountToken: amount.issuer
			? { currency: amount.currency, issuer: { address: amount.issuer } }
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
}