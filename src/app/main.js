import log from '@mwni/log'
import { run as runLedgerApp } from './ledger.js'
import { run as runCrawlApp } from './crawl.js'
import { run as runServerApp } from './server.js'


export default async function({ config }){
	runLedgerApp({ config })
		.catch(error => {
			log.error(`ledger app crashed due to fatal error:`)
			log.error(error)
			process.exit(1)
		})

	runCrawlApp({ config })
		.catch(error => {
			log.error(`crawl app crashed due to fatal error:`)
			log.error(error)
			log.warn(`attempting to continue without it`)
		})

	runServerApp({ config })
		.catch(error => {
			log.error(`server app crashed:`)
			log.error(error)
			log.warn(`attempting to continue without it`)
		})


	log.info(`has started`)

	return {
		async terminate(){
			log.info(`shutting down`)
			process.exit()
		}
	}
}