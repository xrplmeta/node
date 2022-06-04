import { unixNow } from '@xrplkit/time'
import { write as writeToState } from './write.js'


export async function advance({ ledger, state }){
	let affects = extractAffects(ledger)
	let journal = await state.journal.readOne({ last: true })
	let newState = { 
		ledgerIndex: state.ledgerIndex + 1,
		entriesCount: state.entriesCount,
		modifiedEntriesCount: 0,
		creationTime: unixNow()
	}

	await state.tx(async () => {
		for(let { create, modify, remove } of affects){
			if(create){
				await writeToState({ state, entry: create, change: 'new' })
				newState.entriesCount++
			}else if(modify){
				await writeToState({ state, entry: modify.previous, change: 'deleted' })
				await writeToState({ state, entry: modify.final, change: 'modified' })
			}else if(remove){
				await writeToState({ state, entry: remove, change: 'deleted' })
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