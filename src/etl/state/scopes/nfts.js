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
*/