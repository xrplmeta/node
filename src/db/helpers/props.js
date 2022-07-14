export function readTokenPropsReduced({ ctx, token, sourceRanking, includeSources }){
	return reduce({
		props: ctx.db.tokenProps.readMany({
			where: {
				token
			}
		}),
		sourceRanking,
		includeSources
	})
}

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


export function readAccountPropsReduced({ ctx, account, sourceRanking, includeSources }){
	return reduce({
		props: ctx.db.accountProps.readMany({
			where: {
				account
			}
		}),
		sourceRanking, 
		includeSources
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


function reduce({ props, sourceRanking, includeSources }){
	let data = {}
	let sources = {}
	let sourceRanks = {}

	for(let { key, value, source } of props){
		let rank = sourceRanking
			? sourceRanking.indexOf(source)
			: 0

		if(rank === -1)
			rank = Infinity

		if(!sources[key] || sourceRanks[key] > rank){
			data[key] = value
			sources[key] = source
			sourceRanks[key] = rank
		}
	}

	if(includeSources){
		return Object.entries(data).reduce(
			(composite, [key, value]) => ({
				...composite,
				[key]: {
					value,
					source: sources[key]
				}
			}),
			{}
		)
	}else{
		return data
	}
}