import log from '@mwni/log'
import { create as createPool } from '../lib/xrpl/pool.js'
import { spawnApp as spawnLedgerApp } from './ledger/index.js'


export default async function({ config }){
	const xrpl = createPool(config.ledger.sources)
	const ledgerApp = await spawnLedgerApp({ config, xrpl })


	ledgerApp.run()
		.catch(error => {
			log.error(`ledger app crashed due to fatal error:`)
			log.error(error)
			process.exit(1)
		})


	return {
		async terminate(){
			log.info(`shutting down`)
			
			await ledgerApp.terminate()
		}
	}
}