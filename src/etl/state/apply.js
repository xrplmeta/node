import * as accounts from './scopes/accounts.js'
import * as tokens from './scopes/tokens.js'
import * as tokenOffers from './scopes/tokenoffers.js'
import * as nfts from './scopes/nfts.js'
import * as nftOffers from './scopes/nftoffers.js'


const ledgerEntryModules = {
	AccountRoot: accounts,
	RippleState: tokens,
	Offer: tokenOffers,
	NFTokenPage: nfts,
	NFTokenOffer: nftOffers,
}


export function applyObjects({ ctx, objects }){
	return applyDeltas({
		ctx,
		deltas: objects.map(entry => ({ 
			type: entry.LedgerEntryType,
			index: entry.index,
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
					index: CreatedNode.LedgerIndex,
					final: {
						...CreatedNode.NewFields,
						PreviousTxnLgrSeq: ledger.sequence
					}
				})
			}else if(ModifiedNode && ModifiedNode.FinalFields){
				deltas.push({
					type: ModifiedNode.LedgerEntryType,
					index: ModifiedNode.LedgerIndex,
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
					index: DeletedNode.LedgerIndex,
					previous: {
						...DeletedNode.FinalFields,
						...DeletedNode.PreviousFields,
						PreviousTxnLgrSeq: ledger.sequence
					}
				})
			}
		}
	}

	if(ctx.backwards){
		return applyDeltas({
			ctx: {
				...ctx,
				ledgerSequence: ledger.sequence - 1
			},
			deltas: deltas
				.map(({ type, index, previous, final }) => ({ type, index, previous: final, final: previous }))
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

	for(let { type, index, previous, final } of deltas){
		let module = ledgerEntryModules[type]

		if(!module)
			continue

		let parsedPrevious = previous 
			? module.parse({ index, entry: previous }) 
			: undefined

		let parsedFinal = final
			? module.parse({ index, entry: final }) 
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