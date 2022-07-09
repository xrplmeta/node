export function writeTokenProps({ ctx, token, props, source }){
	ctx.db.tx(() => {
		for(let [key, value] of Object.entries(props)){
			if(value == null){
				ctx.db.tokenProps.deleteOne({
					where: {
						token,
						key,
						source
					}
				})
			}else{
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
	})
	
}

export function writeAccountProps({ ctx, account, props, source }){
	ctx.db.tx(() => {
		for(let [key, value] of Object.entries(props)){
			if(value == null){
				ctx.db.accountProps.deleteOne({
					where: {
						account,
						key,
						source
					}
				})
			}else{
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
	})
}