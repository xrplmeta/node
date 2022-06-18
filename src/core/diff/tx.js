export function deriveDeltas({ ledger }){
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

	return deltas
}