import { fork } from 'nanotasks'
import NodePool from '../xrpl/pool.js'


const tasks = [
	'ledger/stream',
	//'ledger/snapshot',
	//'server'
]


export async function run({ log, config }){
	let xrpl = new NodePool({ config })

	log.info(`using nodes:`)

	for(let { url } of config.ledger.sources){
		log.info(` - ${url}`)
	}

	for(let task of tasks){
		await fork({
			file: `./${task}.js`,
			args: {
				log: log.branch({ name: task }),
				config, 
				xrpl
			}
		})

		log.info(`spawned task [${task}]`)
	}
}