import * as parsers from './ops/parse.js'
import * as groupers from './ops/group.js'
import * as differs from './ops/diff.js'


export function applyObjects({ ctx, objects }){
	return applyDeltas({
		ctx,
		deltas: objects.map(entry => ({ 
			type: entry.LedgerEntryType,
			final: entry 
		}))
	})
}

export function applyTransactions({ ctx, ledger }){
	let deltas = []

	for(let transaction of ledger.transactions){
		let meta = transaction.meta || transaction.metaData

		for(let { CreatedNode, ModifiedNode, DeletedNode } of meta.AffectedNodes){
			if(CreatedNode && CreatedNode.NewFields){
				deltas.push({
					type: CreatedNode.LedgerEntryType,
					final: {
						...CreatedNode.NewFields,
						PreviousTxnLgrSeq: ledger.sequence
					}
				})
			}else if(ModifiedNode && ModifiedNode.FinalFields){
				deltas.push({
					type: ModifiedNode.LedgerEntryType,
					previous: {
						...ModifiedNode.FinalFields,
						...ModifiedNode.PreviousFields,
						PreviousTxnLgrSeq: ModifiedNode.PreviousTxnLgrSeq
					},
					final: {
						...ModifiedNode.FinalFields,
						PreviousTxnLgrSeq: ledger.sequence
					}
				})
			}else if(DeletedNode){
				deltas.push({
					type: DeletedNode.LedgerEntryType,
					previous: {
						...DeletedNode.FinalFields,
						...DeletedNode.PreviousFields,
						PreviousTxnLgrSeq: ledger.sequence
					}
				})
			}
		}
	}

	return applyDeltas({
		ctx: { ...ctx, ledgerSequence: ledger.sequence },
		deltas
	})
}

function applyDeltas({ ctx, deltas }){
	let groups = {}

	for(let { type, previous, final } of deltas){
		let parse = parsers[type]

		if(!parse)
			continue

		let parsedPrevious = previous 
			? parse({ entry: previous }) 
			: undefined

		let parsedFinal = final
			? parse({ entry: final }) 
			: undefined

		if(!parsedPrevious && !parsedFinal)
			continue

		let grouped = groupers[type]({ 
			previous: parsedPrevious, 
			final: parsedFinal 
		})

		for(let { group, previous, final } of grouped){
			if(!groups[group.key])
				groups[group.key] = {
					...group,
					deltas: []
				}

			groups[group.key].deltas.push({
				previous,
				final
			})
		}
	}

	for(let { type, key, ...group } of Object.values(groups)){
		differs[type]({ ctx, ...group })
	}

	return Object.values(groups).reduce(
		(subjects, { key, deltas, ...group }) => {
			subjects[key] = group
			return subjects
		},
		{}
	)
}