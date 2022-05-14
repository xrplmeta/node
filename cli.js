import minimist from 'minimist'
import log from './lib/log.js'
import { find as findConfig, load as loadConfig } from './lib/config.js'
import { run as runApp } from './app/index.js'



const args = minimist(process.argv.slice(2))
const configPath = args.config
	? args.config
	: findConfig()


log.config({
	name: 'main',
	color: 'yellow',
	severity: args.log || 'info'
})

log.info(`*** XRPLMETA NODE ***`)
log.info(`using config at "${configPath}"`)


const config = loadConfig(configPath, true)
const command = args._[0] || 'run'

log.info(`data directory is at "${config.data.dir}"`)


switch(command){
	case 'run': {
		await runApp({ config })
		break
	}

	default: {
		log.error(`"${command}" is an unknown command`)
		break
	}
}

/*
switch(command){
	case 'run': {
		const xrpl = new XRPL.Master(config.ledger)
		const only = args.only ? args.only.split(',') : null
		const activeTasks = []

		for(let task of Object.values(tasks)){
			let { id } = task.spec

			if(task.willRun && !task.willRun(config)){
				log.warn(`disabling [${id}] (as per config)`)
				continue
			}

			if(only && !only.includes(id)){
				log.warn(`disabling [${id}] (as per argument)`)
				continue
			}
			
			activeTasks.push({
				task: id,
				waitFor: task.willWait
					 ? task.willWait(config)
					 : null
			})
		}

		if(activeTasks.length === 0){
			log.error('no tasks to run, bye')
			process.exit()
		}

		for(let { task, waitFor } of activeTasks){
			spawnTask({
				task,
				configPath,
				xrpl,
				waitFor
			})
		}

		log.info(`all processes up`)
		break
	}

	case 'work': {
		const task = Object.values(tasks).
			find(task => task.spec.id === args.task)

		const xrpl = isWorker
			? new XRPL.Consumer()
			: new XRPL.Master(config.ledger)

		log.config({
			name: args.task, 
			color: 'cyan',
			isSubprocess: isWorker
		})

		if(!task){
			log.error(`task "${args.task}" does not exists`)
			process.exit(1)
		}

		await task.run({config, xrpl})
		process.exit(0)
	}

	default: {
		log.error(`"${command}" is an unknown command`)
		break
	}
}
*/