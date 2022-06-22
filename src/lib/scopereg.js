export function createScopeRegistry(){
	let scopes = {}

	return {
		affectedScope({ change, ...scope }){
			let key
			let { account, token, offer } = scope

			if(account){
				key = `acc:${account.address}`
			}else if(token){
				key = `tok:${token.currency}:${token.issuer?.address}`
			}else if(offer){
				key = `off:${offer.account.address}:${offer.accountSequence}`
			}

			if(!scopes[key])
				scopes[key] = {
					...scope,
					changes: new Set()
				}

			scopes[key].changes.add(change)
		},

		affectedScopes(){
			return Object.values(scopes)
		}
	}
}