export async function getState({ snapshot }){
	return await snapshot.journal.readOne({ last: true })
}

export async function getCurrentIndex({ snapshot }){
	let state = await getState({ snapshot })
	return state.ledgerIndex
}

export async function isIncomplete({ snapshot }){
	let state = await getState({ snapshot })
	return !state || state.snapshotMarker || state.entriesCount === 0
}

export async function isCheckpointDue({ snapshot, config }){
	let state = await getState({ snapshot })
	return state.ledgerIndex % config.ledger.checkpoint.everyNthLedger === 0
}