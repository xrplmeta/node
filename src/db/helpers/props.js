export function writeTokenProps({ ctx, token, props, source }){
	for(let [key, value] of Object.entries(props)){
		ctx.db.tokenProps.createOne({
			data: {
				token,
				key,
				value,
				source
			}
		})
	}
}

export function writeAccountProps({ ctx, account, props, source }){
	for(let [key, value] of Object.entries(props)){
		ctx.db.accountProps.createOne({
			data: {
				account,
				key,
				value,
				source
			}
		})
	}
}