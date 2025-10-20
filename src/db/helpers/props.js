import { readTokenMetrics } from './tokenmetrics.js'
import { 
	markCacheDirtyForAccountIcons, 
	markCacheDirtyForAccountProps, 
	markCacheDirtyForTokenIcons, 
	markCacheDirtyForTokenProps
} from '../../cache/todo.js'
import TokenType from '../../xrpl/tokentype.js'


export function diffMultiTokenProps({ ctx, tokens, source }){
	for(let { currency, issuer, mptIssuanceId, props } of tokens){
		writeTokenProps({
			ctx,
			token: {
				currency,
				issuer,
				mptIssuanceId,
				tokenType: mptIssuanceId ? TokenType.MPT : TokenType.IOU
			},
			props,
			source
		})
	}
}

export function diffMultiAccountProps({ ctx, accounts, source }){
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
}


export function readTokenProps({ ctx, token }){
	let props = ctx.db.core.tokenProps.readMany({
		where: {
			token
		}
	})

	let issuerGivenTrustLevelProps = []
	let issuerProps = readAccountProps({
		ctx,
		account: token.issuer
			? token.issuer
			: ctx.db.core.tokens.readOne({ where: token }).issuer
	})

	for(let { key, value, source } of issuerProps){
		if(key !== 'trust_level')
			continue

		let existingTrustProp = props.find(
			prop => prop.key === 'trust_level' && prop.source === source
		)

		if(existingTrustProp){
			existingTrustProp.value = Math.max(existingTrustProp.value, 1)
		}else{
			issuerGivenTrustLevelProps.push({
				key: 'trust_level',
				value,
				source
			})
		}
	}

	if(issuerGivenTrustLevelProps.length > 0){
		let { holders } = readTokenMetrics({ 
			ctx, 
			token, 
			metrics: {
				holders: true
			}
		})

		if(holders > 0){
			props.push(...issuerGivenTrustLevelProps)
		}
	}
	
	return props.map(({ key, value, source }) => ({ key, value, source }))
}

export function writeTokenProps({ ctx, token, props, source }){
	if(Object.keys(props).length === 0) {
		clearTokenProps({
			ctx,
			token,
			source
		})
		return
	}

	ctx.db.core.tx(() => {
		const keysToInsert = Object.keys(props)
		
		const keysToDelete = ctx.db.core.tokenProps.readMany({
			select: {id: true, key: true},
			where: {
				token,
				source
			}
		}).filter(({ key }) => !keysToInsert.includes(key))

		ctx.db.core.tokenProps.deleteMany({
			where: {
				id: {
					in: keysToDelete.map(
						({ id }) => id
					)
				}
			}
		})

		for(let [key, value] of Object.entries(props)){
			ctx.db.core.tokenProps.createOne({
				data: {
					token,
					key,
					value,
					source
				}
			})
		}
	})

	markCacheDirtyForTokenProps({ ctx, token })

	if(props.hasOwnProperty('icon'))
		markCacheDirtyForTokenIcons({ ctx, token })
}


export function readAccountProps({ ctx, account }){
	let props = ctx.db.core.accountProps.readMany({
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

	let { domain } = ctx.db.core.accounts.readOne({
		where: account,
		select: {
			domain: true
		}
	})
	
	if(domain)
		props.push({
			key: 'domain',
			value: domain,
			source: 'ledger'
		})


	return props.map(({ key, value, source }) => ({ key, value, source }))
}

export function writeAccountProps({ ctx, account, props, source }){
	if(Object.keys(props).length === 0){
		clearAccountProps({
			ctx,
			account,
			source
		})
		return
	}

	ctx.db.core.tx(() => {
		const keysToInsert = Object.keys(props)
		
		const keysToDelete = ctx.db.core.accountProps.readMany({
			select: {id: true, key: true},
			where: {
				account,
				source
			}
		}).filter(({ key }) => !keysToInsert.includes(key))
		
		ctx.db.core.accountProps.deleteMany({
			where: {
				id: {
					in: keysToDelete.map(
						({ id }) => id
					)
				}
			}
		})

		for(let [key, value] of Object.entries(props)){
			ctx.db.core.accountProps.createOne({
				data: {
					account,
					key,
					value,
					source
				}
			})
		}
	})

	markCacheDirtyForAccountProps({ ctx, account })

	if(props.hasOwnProperty('icon'))
		markCacheDirtyForAccountIcons({ ctx, account })
}


export function clearTokenProps({ ctx, token, source }){
	let deletedNum = ctx.db.core.tokenProps.deleteMany({
		where: {
			token,
			source
		}
	})
	
	if(deletedNum > 0){
		markCacheDirtyForTokenProps({ ctx, token })
		markCacheDirtyForTokenIcons({ ctx, token })
	}
}

export function clearAccountProps({ ctx, account, source }){
	let deletedNum = ctx.db.core.accountProps.deleteMany({
		where: {
			account,
			source
		}
	})
	
	if(deletedNum > 0){
		markCacheDirtyForAccountProps({ ctx, account })
		markCacheDirtyForAccountIcons({ ctx, account })
	}
}