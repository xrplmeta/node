import createPool from '../xrpl/pool.js'
import * as ledgerSnapshot from './ledger/snapshot.js'


const tasks = [
	ledgerSnapshot
]

export async function start({ args, config, log }){
	let xrplLog = log.fork({ name: 'xrpl' })
	let xrpl = createPool({ config, log: xrplLog })
	let activeTasks = []

	for(let task of tasks){
		let taskLog = log.fork({ name: task.name })
		let ctx = { args, config, xrpl, log: taskLog }

		if(await task.skip(ctx)){
			log.info(`skipping task [${task.name}]`)
			continue
		}

		log.info(`starting task [${task.name}]`)
		activeTasks.push(() => task.start(ctx))
	}

	Promise.all(activeTasks.map(f => f()))
		.then(() => log.info(`all tasks up`))

	return {
		terminate(){
			log.info(`shutting down`)
		}
	}
}