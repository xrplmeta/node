import minimist from 'minimist'
import log from './lib/log.js'
import initRepo from './lib/repo/index.js'
import { find as findConfig, load as loadConfig } from './lib/config.js'
import { Hub, Client } from './lib/xrpl/adapter.js'
import { spawn as spawnTask } from './lib/tasks.js'
import { tasks as crawlerTasks } from './crawler/index.js'
import { tasks as serverTasks } from './server/index.js'


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
const tasks = {...crawlerTasks, ...serverTasks}

log.info(`data directory is at "${config.data.dir}"`)

const repo = initRepo(config)


switch(command){
	case 'run': {
		const xrpl = new Hub(config.xrpl)
		const only = args.only ? args.only.split(',') : null
		const activeTasks = []

		for(let [id, task] of Object.entries(tasks)){
			if(!task.willRun(config)){
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
		
		repo.monitorWAL(60000, 100000000)
		break
	}

	case 'work': {
		const xrpl = new Client()
		const task = tasks[args.task]

		log.config({
			name: args.task, 
			color: 'cyan',
			isSubprocess: true
		})

		task.run({config, repo, xrpl})
		break
	}

	case 'flush': {
		repo.flushWAL()
		break
	}

	default: {
		log.error(`"${command}" is an unknown command`)
		break
	}
}


