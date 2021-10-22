import xrpl from 'xrpl'
import { log } from '../shared/utils.js'

log = log.for({name: 'discovery', color: 'cyan'})

export async function run(nodeAddress){
	let client = new xrpl.Client(nodeAddress)

	log(`connecting to ${nodeAddress}...`)
	await client.connect()

	let ledgerIndex = await client.getLedgerIndex()

	log(`scanning ledger #${ledgerIndex}...`)

	
}