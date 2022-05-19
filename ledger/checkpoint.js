import log from '@mwni/log'


export async function create({ config, ledger }){
	let state = await ledger.getState()

	log.info(`creating checkpoint at ledger #${state.ledgerIndex}`)

	
}