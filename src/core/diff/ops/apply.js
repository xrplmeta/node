export function AccountRoot({ ctx, deltas }){
	for(let { previous, final } of deltas){
		if(final){
			ctx.meta.accounts.createOne({ 
				data: final 
			})
		}else{
			ctx.meta.accounts.deleteOne({
				where: {
					address: previous.address
				}
			})
		}
	}
}

export function RippleState({ ctx, deltas }){
	const maxWhales = ctx.config.ledger.tokens.captureWhales
	const ignoreBelowTrustlines = ctx.config.ledger.tokens.ignoreBelowTrustlines

	let token = ctx.meta.tokens.createOne({
		data: deltas[0].token
	})

	let metrics = {
		trustlines: 0,
		holders: 0,
		supply: 0,
		...readMetrics({ 
			ctx, 
			token, 
			ledgerIndex: ctx.ledgerIndex,
			forward: ctx.forwardDiff,
			metrics: {
				trustlines: true,
				holders: true,
				supply: true
			}
		})
	}

	for(let { previous, final } of deltas){
		
	}
}

export function CurrencyOffer({ meta, deltas }){
	
}

export function NFTokenPage({ meta, deltas }){
	
}

export function NFTokenOffer({ meta, deltas }){
	
}



function updateMetrics({ tokenId, meta, state, ledgerIndex, config }){
	let { currency, issuer } = state.tokens.readOne({
		where: {
			id: tokenId
		},
		include: {
			issuer: true
		}
	})

	let maxWhales = config.ledger.tokens.captureWhales
	let ignoreBelowTrustlines = config.ledger.tokens.ignoreBelowTrustlines

	let metrics = {
		trustlines: state.trustlines.count({
			where: {
				token: {
					id: tokenId
				}
			}
		}),
		holders: state.trustlines.count({
			where: {
				token: {
					id: tokenId
				},
				NOT: {
					balance: 0
				}
			}
		}),
		supply: 0,
		...readMetrics({ 
			meta,
			ledgerIndex,
			supply: true
		})
	}

	let { id } = meta.tokens.createOne({
		data: {
			currency,
			issuer: { address: issuer.address },
		}
	})
	
	let whales = readWhales({
		meta,
		ledgerIndex,
		token: { id }
	})
	
	let trustlines = state.trustlines.readMany({
		where: {
			token: {
				id: tokenId
			},
			NOT: {
				change: null
			},
		},
		include: {
			account: true
		}
	})
	
	for(let { id: trustlineId, account, balance, change } of trustlines){
		whales = whales
			.filter(whale => whale.account.address !== account.address)

		if(change === 'deleted'){
			metrics.supply = sub(metrics.supply, balance)
			metrics.trustlines--
			metrics.holders--

			state.trustlines.delete({
				where: {
					id: trustlineId
				}
			})
		}else{
			metrics.supply = sum(metrics.supply, balance)

			let whale = { account, balance }
			let greaterWhaleIndex = whales
				.findIndex(whale => gt(whale.balance, balance))


			if(greaterWhaleIndex === -1){
				whales.push(whale)
			}else if(greaterWhaleIndex === 0){
				if(whales.length < maxWhales)
					whales.unshift(whale)
			}else{
				whales.splice(greaterWhaleIndex, 0, whale)
			}

			if(whales.length > maxWhales)
				whales.shift()
		}
	}

	if()

	if(metrics.holders === 0 && metrics.trustlines < ignoreBelowTrustlines){
		meta.tokens.delete({
			where: {
				currency,
				issuer: { address: issuer.address },
			}
		})
		return
	}
	
	writeMetrics({
		meta,
		token: { id },
		ledgerIndex,
		...metrics
	})
	
	writeWhales({
		meta,
		token: { id },
		ledgerIndex,
		whales
	})

	if(issuer.change){
		updateIssuer({ account: issuer, state, meta })
	}
}

async function updateIssuer({ account, state, meta }){
	writeProps({
		meta,
		props: {
			blackholed: account.blackholed,
			emailHash: account.emailHash,
			domain: account.domain
				? Buffer.from(account.domain, 'hex').toString()
				: undefined
		},
		source: 'xrpl',
		account: { address: account.address }
	})
}