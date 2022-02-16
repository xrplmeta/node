import { fork} from 'child_process'
import { fileURLToPath } from 'url'
import minimist from 'minimist'
import log from '@xrplmeta/log'
import { load as loadConfig } from '@xrplmeta/config'
import initRepo from '@xrplmeta/repo'
import { Host, Client } from './ledger/adapter.js'
import context from './providers/context.js'
import providers from './providers/index.js'

const args = minimist(process.argv.slice(2))
const configPath = args.config || 'crawler.toml'



switch(args._[0]){
	case 'flush-wal': {
		const config = loadConfig(configPath)
		const repo = initRepo(config)
		
		log.info(`one-time flushing database WAL file...`)
		repo.flushWAL()
		process.exit(0)
		break
	}

	case 'work': {
		log.config({
			name: args.task, 
			color: 'cyan',
			isSubprocess: true
		})

		const config = loadConfig(configPath)
		const repo = initRepo(config)
		const xrpl = new Client()

		providers[args.task](
			context({config, repo, xrpl})
		)
		break
	}

	default: {
		log.config({
			name: 'main', 
			color: 'yellow', 
			severity: args.log || 'info'
		})

		log.info(`*** XRPLMETA CRAWLER ***`)
		log.info(`starting with config "${configPath}"`)

		const config = loadConfig(configPath)
		const repo = initRepo(config)
		const only = args.only ? args.only.split(',') : null
		const xrpl = new Host(config)
		const tasks = Object.keys(providers)
			.filter(key => !only || only.includes(key))


		if(tasks.length === 0){
			log.error(`no tasks selected - terminating under these circumstances`)
			process.exit()
		}

		log.info('spawning processes...')

		for(let task of tasks){
			if(config[task]?.disabled){
				log.info(`task [${task}] is disabled by config`)
				continue
			}

			let subprocess = fork(
				fileURLToPath(import.meta.url), 
				[
					`work`,
					`--config`, configPath,
					`--task`, task
				]
			)

			xrpl.register(subprocess)
			log.subprocess(subprocess)

			subprocess.on('error', error => {
				log.error(`subprocess [${task}] encountered error:`)
				log.error(error)
				xrpl.discard(subprocess)
			})

			subprocess.on('exit', code => {
				log.error(`subprocess [${task}] exited with code ${code}`)
				xrpl.discard(subprocess)
			})

			log.info(`spawned [${task}]`)
		}

		log.info(`all processes up`)

		repo.monitorWAL(60000, 100000000)
		break
	}
}


