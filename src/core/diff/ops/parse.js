import { div, lt, gt, neg, max } from '@xrplkit/xfl'
import { fromRippled as fromRippledAmount } from '@xrplkit/amount'
import { rippleToUnix } from '@xrplkit/time'
import { encodeAccountID } from 'ripple-address-codec'
import { isBlackholed } from '../../../lib/xrpl/blackhole.js'


export function AccountRoot({ entry }){
	return {
		address: entry.Account,
		emailHash: entry.EmailHash,
		balance: div(entry.Balance, '1000000'),
		transferRate: entry.transferRate,
		blackholed: isBlackholed(entry),
		domain: entry.domain
			? Buffer.from(entry.domain, 'hex').toString()
			: undefined,
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
			balance: max(0, neg(entry.Balance.value)),
			previousSequence: entry.PreviousTxnLgrSeq
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
			balance: max(0, entry.Balance.value),
			previousSequence: entry.PreviousTxnLgrSeq
		}
	}

	return transformed
}

export function Offer({ entry }){
	let takerPays = fromRippledAmount(entry.TakerPays)
	let takerGets = fromRippledAmount(entry.TakerGets)
	let size = takerGets.value
	let qualityHex = entry.BookDirectory.slice(-16)

	try{
		let qualityMantissa = Buffer.from(`00${qualityHex.slice(2)}`, 'hex')
			.readBigInt64BE(0)

		let qualityExponent = Buffer.from(qualityHex.slice(0, 2), 'hex')
			.readInt8(0) 
			- 100
			+ (takerPays.currency === 'XRP' ? -6 : 0) 
			- (takerGets.currency === 'XRP' ? -6 : 0)

		var quality = `${qualityMantissa}e${qualityExponent}`
	}catch{
		return
	}

	return {
		account: { address: entry.Account },
		sequence: entry.Sequence,
		directory: entry.BookDirectory,
		takerPays: {
			currency: takerPays.currency,
			issuer: takerPays.issuer
				? { address: takerPays.issuer }
				: undefined
		},
		takerGets: {
			currency: takerGets.currency,
			issuer: takerGets.issuer
				? { address: takerGets.issuer }
				: undefined
		},
		quality,
		size,
		expiration: entry.Expiration
			? rippleToUnix(entry.Expiration)
			: null,
		previousSequence: entry.PreviousTxnLgrSeq
	}
}

/*
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
*/