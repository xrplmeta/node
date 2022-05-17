import log from '@mwni/log'
import createPool from '../xrpl/pool.js'
import startLedger from './ledger.js'


export default async function({ config }){
	let xrpl = createPool(config.ledger.sources)
	
	startLedger({ config, xrpl })


	return {
		terminate(){
			log.info(`shutting down`)
		}
	}
}