import log from '@mwni/log'
import { create as createPool } from '../lib/xrpl/pool.js'
import { run as runLedgerApp } from './ledger/index.js'


export default async function({ config }){
	const xrpl = createPool(config.ledger.sources)
	
	runLedgerApp({ config, xrpl })
		.catch(error => {
			log.error(`ledger app crashed due to fatal error:`)
			log.error(error)
			process.exit(1)
		})


	return {
		async terminate(){
			log.info(`shutting down`)
			process.exit()
		}
	}
}