export function AccountRoot({ previous, final }){
	let address = previous?.address || final?.address

	return [{
		group: {
			type: 'Account',
			key: address,
			account: {
				address
			}
		},
		previous,
		final
	}]
}

export function RippleState({ previous, final }){
	let groups = []

	for(let side of ['low', 'high']){
		let entry = final
			? final[side]
			: previous[side]

		if(!entry)
			continue

		groups.push({
			group: {
				type: 'Token',
				token: entry.token,
				key: `${entry.token.currency}:${entry.token.issuer.address}`,
			},
			previous: previous ? previous[side] : undefined,
			final: final ? final[side] : undefined
		})
	}

	return groups
}

export function Offer({ previous, final }){
	let entry = previous || final
	let key = (
		`${entry.takerPays?.currency}:${entry.takerPays?.issuer?.address}/`
		+ `${entry.takerGets?.currency}:${entry.takerGets?.issuer?.address}`
	)

	return [{
		group: {
			type: 'Book',
			book: {
				takerPays: entry.takerPays,
				takerGets: entry.takerGets,
			},
			key
		},
		previous,
		final
	}]
}

export function NFTokenPage({ previous, final }){
	let entry = previous || final

	return [{
		group: {
			type: 'NFTPage',
			account: {
				address: entry.account.address
			},
			key: entry.account.address,
		},
		previous,
		final
	}]
}

export function NFTokenOffer({ previous, final }){
	let entry = previous || final

	return [{
		group: {
			type: 'NFTOffer',
			nft: {
				tokenId: entry.tokenId,
			},
			key: entry.tokenId,
		},
		previous,
		final
	}]
}