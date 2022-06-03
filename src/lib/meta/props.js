export async function storeMetas({ meta, metas, issuer, token, nft }){
	let table
	let subject

	if(issuer){
		table = 'issuerMetas'
		subject = { issuer }
	}

	for(let [key, value] of Object.entries(metas)){
		
	}
}