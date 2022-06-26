import * as accounts from './scopes/accounts.js'
import * as tokens from './scopes/tokens.js'
import * as tokenOffers from './scopes/tokenoffers.js'

const ledgerEntryModules = {
	AccountRoot: accounts,
	RippleState: tokens,
	Offer: tokenOffers
}


export function applyObjects({ ctx, objects }){
	return applyDeltas({
		ctx,
		deltas: objects.map(entry => ({ 
			type: entry.LedgerEntryType,
			final: entry 
		}))
	})
}

export function applyTransactions({ ctx, ledger, backwards }){
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

	if(backwards){
		return applyDeltas({
			ctx: {
				...ctx,
				ledgerSequence: ledger.sequence - 1,
				backwards: true,
			},
			deltas: deltas
				.map(({ type, previous, final }) => ({ type, previous: final, final: previous }))
				.reverse(),
		})
	}else{
		return applyDeltas({
			ctx: {
				...ctx,
				ledgerSequence: ledger.sequence,
			},
			deltas
		})
	}

	
}

function applyDeltas({ ctx, deltas }){
	let groups = {}
	let solos = []

	for(let { type, previous, final } of deltas){
		let module = ledgerEntryModules[type]

		if(!module)
			continue

		let parsedPrevious = previous 
			? module.parse({ entry: previous }) 
			: undefined

		let parsedFinal = final
			? module.parse({ entry: final }) 
			: undefined

		if(!parsedPrevious && !parsedFinal)
			continue

		if(module.group){
			let grouped = module.group({ 
				previous: parsedPrevious, 
				final: parsedFinal 
			})

			for(let { group, previous, final } of grouped){
				if(!groups[group.key])
					groups[group.key] = {
						...group,
						type,
						deltas: []
					}
	
				groups[group.key].deltas.push({
					previous,
					final
				})
			}
		}else{
			solos.push({
				type,
				previous: parsedPrevious, 
				final: parsedFinal 
			})
		}
	}

	for(let { type, key, ...group } of Object.values(groups)){
		ledgerEntryModules[type].diff({ ctx, ...group })
	}

	for(let { type, ...delta } of solos){
		ledgerEntryModules[type].diff({ ctx, ...delta })
	}
}