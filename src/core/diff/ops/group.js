export function AccountRoot({ previous, final }){
	return [{
		key: previous?.address || final?.address,
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
			key: `${entry.token.currency}:${entry.token.issuer.address}`,
			previous: previous ? previous[side] : undefined,
			final: final ? final[side] : undefined
		})
	}

	return groups
}

export function CurrencyOffer({ previous, final }){
	let entry = previous || final

	return [{
		key: `${entry.takerPaysToken?.currency}:${entry.takerPaysToken?.issuer}/${entry.takerGetsToken?.currency}:${entry.takerGetsToken?.issuer}`,
		previous,
		final
	}]
}

export function NFTokenPage({ previous, final }){
	let entry = previous || final

	return [{
		key: entry.account.address,
		previous,
		final
	}]
}

export function NFTokenOffer({ previous, final }){
	let entry = previous || final

	return [{
		key: entry.tokenId,
		previous,
		final
	}]
}