import log from '@mwni/log'
import { run as runLedgerApp } from './ledger.js'
import { run as runCrawlApp } from './crawl.js'
import { run as runCacheApp } from './cache.js'
import { run as runServerApp } from './server.js'
import createIPC from '../lib/ipc.js'


export default async function({ config }){
	const ctx = {
		ipc: createIPC(),
		config,
		log,
	}

	await runLedgerApp({ ctx })
		.catch(error => {
			log.error(`ledger app crashed due to fatal error:`)
			log.error(error)
			process.exit(1)
		})

	log.info(`bootstrap complete`)
	
	runCrawlApp({ ctx })
		.catch(error => {
			log.error(`crawl app crashed due to fatal error:`)
			log.error(error)
			log.warn(`attempting to continue without it`)
		})

	runCacheApp({ ctx })
		.catch(error => {
			log.error(`cache app crashed due to fatal error:`)
			log.error(error)
			log.warn(`attempting to continue without it`)
		})

	runServerApp({ ctx })
		.catch(error => {
			log.error(`server app crashed:`)
			log.error(error)
			log.warn(`attempting to continue without it`)
		})


	return {
		async terminate(){
			log.info(`shutting down`)
			process.exit()
		}
	}
}