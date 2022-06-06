export async function write({ meta, props, source, account, token, nft }){
	let table
	let subject

	if(account){
		table = 'accountProps'
		subject = { account }
	}

	for(let [key, value] of Object.entries(props)){
		if(value == undefined){
			await meta[table].delete({
				where: {
					account,
					key,
					source
				}
			})
		}else{
			await meta[table].createOne({
				data: {
					account,
					key,
					value,
					source
				}
			})
		}
	}
}