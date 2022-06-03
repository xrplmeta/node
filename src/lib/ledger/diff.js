import { unixNow } from '@xrplkit/time'
import { add as addToState, remove as removeFromState } from './ops.js'
import { getState } from './state.js'


export async function advance({ ledger, state }){
	let affects = extractAffects(ledger)
	let state = await getState({ state })
	let newState = { 
		ledgerIndex: state.ledgerIndex + 1,
		entriesCount: state.entriesCount,
		modifiedEntriesCount: 0,
		creationTime: unixNow()
	}

	await state.tx(async () => {
		for(let { create, modify, remove } of affects){
			if(create){
				await addToState({ state, entry: create })
				newState.entriesCount++
			}else if(modify){
				await removeFromState({ state, entry: modify.previous })
				await addToState({ state, entry: modify.final })
			}else if(remove){
				await removeFromState({ state, entry: remove })
				newState.entriesCount--
			}

			newState.modifiedEntriesCount++
		}

		await state.journal.createOne({
			data: {
				...newState,
				completionTime: unixNow()
			}
		})
	})
}

function extractAffects(ledger){
	let affects = []

	for(let transaction of ledger.transactions.reverse()){
		let meta = transaction.meta || transaction.metaData

		for(let { NewNode, ModifiedNode, DeletedNode } of meta.AffectedNodes){
			if(NewNode && NewNode.NewFields){
				affects.push({
					create: {
						...NewNode.NewFields,
						lastModifiedIndex: ledger.index
					}
				})
			}else if(ModifiedNode && ModifiedNode.FinalFields){
				affects.push({
					modify: {
						final: {
							...ModifiedNode.FinalFields,
							lastModifiedIndex: ledger.index
						},
						previous: {
							...ModifiedNode.FinalFields,
							...ModifiedNode.PreviousFields,
							lastModifiedIndex: ModifiedNode.PreviousTxnLgrSeq
						}
					}
				})
			}else if(DeletedNode){
				affects.push({
					remove: {
						...DeletedNode.FinalFields,
						lastModifiedIndex: ledger.index
					}
				})
			}
		}
	}

	return affects
}