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
						OR: [
							{
								expirationLedgerSequence: null
							},
							{
								expirationLedgerSequence: {
									greaterThan: ledgerSequence
								}
							}
						]
					}
					: {}
			)
		}
	})
}

export function writePoint({ table, selector, ledgerSequence, data, expirable }){
	let point = readPoint({
		table,
		selector,
		ledgerSequence,
		expirable
	})

	if(point){
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

		if(point.ledgerSequence === ledgerSequence){
			return table.updateOne({
				data: changes,
				where: {
					id: point.id
				}
			})
		}

		if(expirable){
			table.updateOne({
				data: {
					expirationLedgerSequence: ledgerSequence
				},
				where: {
					id: point.id
				}
			})
		}
	}

	return table.createOne({
		data: {
			...selector,
			ledgerSequence,
			...data
		}
	})
}

export function clearPoint({ table, selector, ledgerSequence, expirable }){
	let point = readPoint({
		table,
		selector,
		ledgerSequence,
		expirable
	})

	if(point){
		if(point.ledgerSequence === ledgerSequence){
			return table.deleteOne({
				where: {
					id: point.id
				}
			})
		}

		if(expirable){
			return table.updateOne({
				data: {
					expirationLedgerSequence: ledgerSequence
				},
				where: {
					id: point.id
				}
			})
		}else{
			return table.createOne({
				data: {
					...selector,
					ledgerSequence
				}
			})
		}
	}
}