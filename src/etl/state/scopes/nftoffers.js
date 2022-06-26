/*
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