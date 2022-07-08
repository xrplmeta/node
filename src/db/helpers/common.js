const minLedgerSequence = 0
const maxLedgerSequence = 1_000_000_000_000


export function readPoint({ table, selector, ledgerSequence, expirable }){
	if(expirable){
		return table.readOne({
			where: {
				...selector,
				ledgerSequence: {
					lessOrEqual: ledgerSequence
				},
				lastLedgerSequence: {
					greaterOrEqual: ledgerSequence
				}
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
	let headSequenceKey = 'ledgerSequence'
	let tailSequenceKey = 'ledgerSequence'

	let expirySequence = backwards
		? ledgerSequence + 1
		: ledgerSequence - 1

	let offboundSequence = backwards
		? minLedgerSequence
		: maxLedgerSequence

	if(expirable){
		if(backwards)
			headSequenceKey = 'lastLedgerSequence'
		else
			tailSequenceKey = 'lastLedgerSequence'
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

		if(expirable || backwards){
			table.createOne({
				data: {
					...point,
					[tailSequenceKey]: expirySequence
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
				expirable || backwards
				? {
					[headSequenceKey]: ledgerSequence,
					[tailSequenceKey]: point
						? point[tailSequenceKey]
						: offboundSequence
				}
				: {
					[headSequenceKey]: ledgerSequence
				}
			),
			...data
		}
	})
}