import { fork } from 'nanotasks'
import NodePool from '../xrpl/pool.js'


const tasks = [
	'ledger/stream',
	//'ledger/snapshot',
	//'server'
]


export async function run({ config, log }){
	let xrpl = new NodePool({ config })

	log.info(`using nodes:`)

	for(let { url } of config.ledger.sources){
		log.info(` - ${url}`)
	}

	for(let task of tasks){
		let { default: run } = await import(`./${task}.js`)

		run({ config, xrpl, log: log.fork({name: task}) })
	}

	return {
		terminate(){
			log.info(`shutting down`)
		}
	}
}