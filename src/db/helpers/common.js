const maxLedgerSequence = 1_000_000_000_000


export function readPoint({ table, selector, ledgerSequence, expirable }){
	if(ledgerSequence === undefined){
		return table.readOne({
			where: selector,
			orderBy: {
				ledgerSequence: 'desc'
			}
		})
	}else if(expirable){
		return table.readOne({
			where: {
				...selector,
				ledgerSequence: {
					lessOrEqual: ledgerSequence
				},
				lastLedgerSequence: {
					greaterOrEqual: ledgerSequence
				}
			},
			orderBy: {
				ledgerSequence: 'desc'
			}
		})
	}else{
		return table.readOne({
			where: {
				...selector,
				ledgerSequence: {
					lessOrEqual: ledgerSequence
				}
			},
			orderBy: {
				ledgerSequence: 'desc'
			}
		})
	}
}

export function writePoint({ table, selector, ledgerSequence, backwards, data, expirable }){
	let point = readPoint({
		table,
		selector,
		ledgerSequence,
		expirable
	})

	if(point){
		let replace = point.ledgerSequence === ledgerSequence

		if(data){
			let changes = {}

			for(let [key, value] of Object.entries(data)){
				let a = value != null ? value.toString() : value
				let b = point[key] != null ? point[key].toString() : point[key]

				if(a != b){
					changes[key] = value
				}
			}

			if(Object.keys(changes).length === 0)
				return

			if(replace){
				return table.updateOne({
					data: changes,
					where: {
						id: point.id
					}
				})
			}
		}else{
			if(replace){
				return table.deleteOne({
					where: {
						id: point.id
					}
				})
			}
		}

		if(expirable){
			table.updateOne({
				data: {
					lastLedgerSequence: ledgerSequence - 1
				},
				where: {
					id: point.id
				}
			})
		}
	}

	if(!data && expirable)
		return

	if(!data && !expirable && !point)
		return

	return table.createOne({
		data: {
			...selector, 
			...(
				expirable
				? {
					ledgerSequence,
					lastLedgerSequence: maxLedgerSequence
				}
				: {
					ledgerSequence
				}
			),
			...data
		}
	})
}

export function getAccountId({ ctx, account }){
	if(account.id)
		return account.id

	return ctx.db.core.accounts.readOne({
		where: account,
		select: {
			id: true
		}
	})?.id
}

export function getTokenId({ ctx, token }){
	if(token.id)
		return token.id

	return ctx.db.core.tokens.readOne({
		where: token,
		select: {
			id: true
		}
	})?.id
}