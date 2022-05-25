export async function getState({ ledger }){
	return await ledger.journal.readOne({ last: true })
}

export async function getCurrentIndex({ ledger }){
	let state = await getState({ ledger })
	return state.ledgerIndex
}

export async function isIncomplete({ ledger }){
	let state = await getState({ ledger })
	return !state || state.snapshotMarker
}