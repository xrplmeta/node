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



export function diff({ ctx, previous, final }){
	if(previous){
		for(let { owner, ...pNft } of previous.nfts){
			if(final && final.nfts.some(fNft => fNft.tokenId === pNft.tokenId))
				continue

			ctx.db.core.nfts.createOne({
				data: ctx.backwards
					? pNft
					: { ...pNft, owner: null }
			})
		}
	}

	if(final){
		for(let { owner, ...fNft } of final.nfts){
			if(previous && previous.nfts.some(pNft => pNft.tokenId === fNft.tokenId))
				continue

			ctx.db.core.nfts.createOne({
				data: ctx.backwards
					? fNft
					: { ...fNft, owner }
			})
		}
	}
}