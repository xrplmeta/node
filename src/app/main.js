import log from '@mwni/log'
import { run as runLedgerApp } from './ledger.js'
import { run as runServerApp } from './server.js'


export default async function({ config }){
	runLedgerApp({ config })
		.catch(error => {
			log.error(`ledger app crashed due to fatal error:`)
			log.error(error)
			process.exit(1)
		})

	runServerApp({ config })
		.catch(error => {
			log.error(`server app crashed:`)
			log.error(error)
			log.warn(`attempting to continue without server app`)
		})


	return {
		async terminate(){
			log.info(`shutting down`)
			process.exit()
		}
	}
}