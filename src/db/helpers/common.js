const maxLedgerSequence = 1_000_000_000_000


export function readPoint({ table, selector, ledgerSequence, expirable }){	
	return table.readOne({
		where: {
			...selector,
			ledgerSequence: {
				lessOrEqual: ledgerSequence
			},
			...(
				expirable
					? {
						lastLedgerSequence: {
							greaterOrEqual: ledgerSequence
						}
					}
					: {}
			)
		}
	})
}

export function writePoint({ table, selector, ledgerSequence, backwards, data, expirable }){
	let headSequenceKey
	let tailSequenceKey
	let expirySequence

	if(backwards){
		headSequenceKey = 'lastLedgerSequence'
		tailSequenceKey = 'ledgerSequence'
		expirySequence = ledgerSequence + 1
	}else{
		headSequenceKey = 'ledgerSequence'
		tailSequenceKey = 'lastLedgerSequence'
		expirySequence = ledgerSequence - 1
	}

	let point = readPoint({
		table,
		selector,
		ledgerSequence,
		expirable
	})

	if(point){
		let override = point[headSequenceKey] === ledgerSequence

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

			if(override){
				return table.updateOne({
					data: changes,
					where: {
						id: point.id
					}
				})
			}
		}else{
			if(override){
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
					[tailSequenceKey]: expirySequence
				},
				where: {
					id: point.id
				}
			})
		}
	}else if(!expirable && !data)
		return

	if(backwards){
		var sequences = expirable
			? { ledgerSequence: 0, lastLedgerSequence: ledgerSequence }
			: { ledgerSequence: 0 }
	}else{
		var sequences = expirable
			? { ledgerSequence, lastLedgerSequence: maxLedgerSequence }
			: { ledgerSequence }
	}

	return table.createOne({
		data: {
			...selector,
			...sequences,
			...data
		}
	})
}