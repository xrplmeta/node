import log from '@mwni/log'
import * as accounts from './accounts.js'
import * as tokens from './tokens.js'
import * as tokenOffers from './tokenoffers.js'
import * as nfts from './nfts.js'
import * as nftOffers from './nftoffers.js'
import * as mptokenIssuance from './mptokenissuance.js'

const ledgerEntryModules = {
	AccountRoot: accounts,
	RippleState: tokens,
	Offer: tokenOffers,
	NFTokenPage: nfts,
	NFTokenOffer: nftOffers,
	MPTokenIssuance: mptokenIssuance,
}


export function applyLedgerStateFromObjects({ ctx, objects }){
	return applyDeltas({
		ctx,
		deltas: objects.map(entry => ({ 
			type: entry.LedgerEntryType,
			index: entry.index,
			final: {
				...entry,
				LedgerSequence: entry.PreviousTxnLgrSeq
			} 
		}))
	})
}

export function applyLedgerStateFromTransactions({ ctx, ledger }){
	let deltas = []

	for(let i = 0; i < ledger.transactions.length; i++){
		let transaction = ledger.transactions[i]
		let meta = transaction.meta || transaction.metaData

		for(let { CreatedNode, ModifiedNode, DeletedNode } of meta.AffectedNodes){
			if(CreatedNode && CreatedNode.NewFields){
				deltas.push({
					type: CreatedNode.LedgerEntryType,
					index: CreatedNode.LedgerIndex,
					ledgerSequence: ledger.sequence,
					transactionIndex: i,
					final: {
						...CreatedNode.NewFields,
						LedgerSequence: ledger.sequence
					}
				})
			}else if(ModifiedNode && ModifiedNode.FinalFields){
				if(ModifiedNode.LedgerEntryType === 'DirectoryNode')
					continue

				if(ctx.backwards && !ModifiedNode.PreviousTxnLgrSeq){
					log.warn(`transaction #${transaction.hash} is missing PreviousTxnLgrSeq - skipping`)
					continue
				}

				deltas.push({
					type: ModifiedNode.LedgerEntryType,
					index: ModifiedNode.LedgerIndex,
					ledgerSequence: ledger.sequence,
					transactionIndex: i,
					previous: {
						...ModifiedNode.FinalFields,
						...ModifiedNode.PreviousFields,
						LedgerSequence: ModifiedNode.PreviousTxnLgrSeq
					},
					final: {
						...ModifiedNode.FinalFields,
						LedgerSequence: ledger.sequence
					}
				})
			}else if(DeletedNode){
				deltas.push({
					type: DeletedNode.LedgerEntryType,
					index: DeletedNode.LedgerIndex,
					ledgerSequence: ledger.sequence,
					transactionIndex: i,
					previous: {
						...DeletedNode.FinalFields,
						...DeletedNode.PreviousFields,
						LedgerSequence: DeletedNode.FinalFields.PreviousTxnLgrSeq
					}
				})
			}
		}
	}

	if(ctx.backwards){
		return applyDeltas({
			ctx,
			deltas: deltas
				.map(({ type, index, ledgerSequence, transactionIndex, previous, final }) => ({ type, index, ledgerSequence, transactionIndex, previous: final, final: previous }))
				.reverse(),
		})
	}else{
		return applyDeltas({
			ctx,
			deltas
		})
	}
}

function applyDeltas({ ctx, deltas }){
	let groups = {}
	let solos = []

	for(let { type, index, ledgerSequence, transactionIndex, previous, final } of deltas){
		let module = ledgerEntryModules[type]

		if(!module)
			continue

		if(module.skip && module.skip({ ctx }))
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
				ledgerSequence,
				transactionIndex,
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