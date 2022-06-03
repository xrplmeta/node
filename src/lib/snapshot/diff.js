import { unixNow } from '@xrplkit/time'
import { add as addToSnapshot, remove as removeFromSnapshot } from './ops.js'
import { getState } from './state.js'


export async function advance({ ledger, snapshot }){
	let affects = extractAffects(ledger)
	let state = await getState({ snapshot })
	let newState = { 
		ledgerIndex: state.ledgerIndex + 1,
		entriesCount: state.entriesCount,
		modifiedEntriesCount: 0,
		creationTime: unixNow()
	}

	await snapshot.tx(async () => {
		for(let { create, modify, remove } of affects){
			if(create){
				await addToSnapshot({ snapshot, entry: create })
				newState.entriesCount++
			}else if(modify){
				await removeFromSnapshot({ snapshot, entry: modify.previous })
				await addToSnapshot({ snapshot, entry: modify.final })
			}else if(remove){
				await removeFromSnapshot({ snapshot, entry: remove })
				newState.entriesCount--
			}

			newState.modifiedEntriesCount++
		}

		await snapshot.journal.createOne({
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