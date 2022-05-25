import log from '@mwni/log'
import createPool from '../xrpl/pool.js'
import startLedger from './ledger.js'


export default async function({ config }){
	let xrpl = createPool(config.ledger.sources)
	
	startLedger({ config, xrpl })
		.catch(error => {
			log.error(`ledger task crashed due to fatal error:`)
			log.error(error)
			process.exit(1)
		})


	return {
		terminate(){
			log.info(`shutting down`)
		}
	}
}