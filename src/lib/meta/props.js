export function write({ meta, props, source, account, token, nft }){
	let table
	let subject

	if(account){
		table = 'accountProps'
		subject = { account }
	}

	for(let [key, value] of Object.entries(props)){
		if(value == undefined){
			meta[table].delete({
				where: {
					account,
					key,
					source
				}
			})
		}else{
			meta[table].createOne({
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