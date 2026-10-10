import { encodeAccountID } from 'ripple-address-codec'


export function parse({ index, entry }){
	let address = encodeAccountID(Buffer.from(index.slice(0, 40), 'hex'))
	let page = {
		account: { address },
		nfts: []
	}

	for(let { NFToken } of entry.NFTokens){
		let issuer = encodeAccountID(Buffer.from(NFToken.NFTokenID.slice(8, 48), 'hex'))
		let uri = NFToken.URI
			? Buffer.from(NFToken.URI, 'hex')
			: null

		page.nfts.push({
			owner: { address },
			issuer: { address: issuer },
			tokenId: NFToken.NFTokenID,
			uri,
		})
	}

	return page
}



export function group({ previous, final }){
	return [{
		group: { key: 'nfts' },
		previous,
		final
	}]
}


export function diff({ ctx, deltas }){
	let removed = new Map()
	let added = new Map()

	for(let { previous, final } of deltas){
		for(let nft of previous?.nfts || [])
			removed.set(nft.tokenId, nft)

		for(let nft of final?.nfts || [])
			added.set(nft.tokenId, nft)
	}

	if(ctx.backwards){
		// Ownership and URI are already known from snapshot / forward sync
		// and must not be touched. Only make sure NFTs that were burned
		// before the snapshot exist in the database.
		for(let nft of [...removed.values(), ...added.values()]){
			let exists = ctx.db.core.nfts.readOne({
				where: { tokenId: nft.tokenId },
				select: { id: true }
			})

			if(exists)
				continue

			let { owner, ...data } = nft

			ctx.db.core.nfts.createOne({ data })
		}

		return
	}

	for(let [tokenId, nft] of removed){
		if(added.has(tokenId))
			continue

		let { owner, ...data } = nft

		ctx.db.core.nfts.createOne({
			data: { ...data, owner: null }
		})
	}

	for(let [tokenId, nft] of added){
		let before = removed.get(tokenId)

		if(before && before.owner.address === nft.owner.address)
			continue

		ctx.db.core.nfts.createOne({ data: nft })
	}
}