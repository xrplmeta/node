import log from '@mwni/log'
import { run as runLedgerApp } from './ledger.js'


export default async function({ config }){
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