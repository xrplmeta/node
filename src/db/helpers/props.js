import { isSameCurrency } from '@xrplkit/amount'
import { updateCacheForAccountProps, updateCacheForTokenProps } from './cache.js'



export function diffTokensProps({ ctx, tokens, source }){
	for(let { currency, issuer, props } of tokens){
		writeTokenProps({
			ctx,
			token: {
				currency,
				issuer
			},
			props,
			source
		})
	}

	let staleProps = ctx.db.tokenProps.readMany({
		where: {
			NOT: {
				OR: tokens.map(
					({ currency, issuer }) => ({
						token: {
							currency,
							issuer
						}
					})
				)
			},
			source
		},
		include: {
			token: true
		}
	})

	ctx.db.tokenProps.deleteMany({
		where: {
			id: {
				in: staleProps.map(
					({ id }) => id
				)
			}
		}
	})

	let deletionAffectedTokens = staleProps
		.map(({ token }) => token)
		.filter(
			(token, index, tokens) => index === tokens.findIndex(
				({ currency, issuer }) => isSameCurrency(token, { currency, issuer })
			)
		)
	
	for(let token of deletionAffectedTokens){
		updateCacheForTokenProps({ ctx, token })
	}
}

export function diffAccountsProps({ ctx, accounts, source }){
	for(let { address, props } of accounts){
		writeAccountProps({
			ctx,
			account: {
				address
			},
			props,
			source
		})
	}

	let accountIds = ctx.db.accounts.readMany({
		select: {
			id: true
		},
		where: {
			address: {
				in: accounts.map(
					({ address }) => address
				)
			}
		}
	}).map(
		({ id }) => id
	)

	let staleProps = ctx.db.accountProps.readMany({
		where: {
			NOT: {
				account: {
					id: {
						in: accountIds
					}
				}
			},
			source
		}
	})

	ctx.db.accountProps.deleteMany({
		where: {
			id: {
				in: staleProps.map(
					({ id }) => id
				)
			}
		}
	})

	let deletionAffectedAccounts = staleProps
		.map(({ account }) => account)
		.filter(
			(account, index, accounts) => index === accounts.findIndex(
				({ address }) => address === account.address
			)
		)
	
	for(let account of deletionAffectedAccounts){
		updateCacheForAccountProps({ ctx, account })
	}
}


export function readTokenProps({ ctx, token }){
	let props = ctx.db.tokenProps.readMany({
		where: {
			token
		}
	})
	
	let issuerKycProps = ctx.db.accountProps.readMany({
		where: {
			account: token.issuer,
			key: 'kyc',
			value: true
		}
	})

	for(let { source } of issuerKycProps){
		let existingTrustProp = props.find(
			prop => prop.key === 'trust_level' && prop.source === source
		)

		if(existingTrustProp){
			existingTrustProp.value = Math.max(existingTrustProp.value, 1)
		}else{
			props.push({
				key: 'trust_level',
				value: 1,
				source
			})
		}
	}
	
	return props.map(({ key, value, source }) => ({ key, value, source }))
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

	updateCacheForTokenProps({ ctx, token })
}


export function readAccountProps({ ctx, account }){
	let props = ctx.db.accountProps.readMany({
		where: {
			account
		}
	})

	let kycProps = props.filter(
		prop => prop.key === 'kyc' && prop.value === true
	)

	for(let { source } of kycProps){
		let trustProp = props.find(
			prop => prop.key === 'trust_level' && prop.source === source
		)

		if(trustProp){
			trustProp.value = Math.max(trustProp.value, 1)
		}else{
			props.push({
				key: 'trust_level',
				value: 1,
				source
			})
		}
	}

	account = ctx.db.accounts.readOne({
		where: account
	})
	
	if(account?.domain)
		props.push({
			key: 'domain',
			value: account.domain,
			source: 'ledger'
		})


	return props.map(({ key, value, source }) => ({ key, value, source }))
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

	updateCacheForAccountProps({ ctx, account })
}


export function clearTokenProps({ ctx, token, source }){
	let deletedNum = ctx.db.tokenProps.deleteMany({
		where: {
			token,
			source
		}
	})
	
	if(deletedNum > 0)
		updateCacheForTokenProps({ ctx, token })
}

export function clearAccountProps({ ctx, account, source }){
	let deletedNum = ctx.db.accountProps.deleteMany({
		where: {
			account,
			source
		}
	})
	
	if(deletedNum > 0)
		updateCacheForAccountProps({ ctx, account })
}


export function reduceProps({ props, expand, sourceRanking }){
	let data = {}
	let sources = {}
	let weblinks = []

	for(let { key, value, source } of props){
		if(expand){
			if(!data[key])
				data[key] = {}

			data[key][source] = value
		}else{
			let rank = sourceRanking
				? sourceRanking.indexOf(source)
				: 0

			if(rank === -1)
				rank = Infinity

			if(key === 'weblinks'){
				weblinks.push({ links: value, rank })
			}else{
				if(!sources.hasOwnProperty(key) || sources[key] > rank){
					data[key] = value
					sources[key] = rank
				}
			}
		}
	}

	if(weblinks.length > 0){
		data.weblinks = weblinks
			.sort((a, b) => a.rank - b.rank)
			.map(({ links }) => links)
			.reduce((a, l) => [...a, ...l], [])
	}

	return data
}