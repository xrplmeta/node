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

log.config({
	name: 'main', 
	color: 'yellow', 
	severity: args.log || 'info'
})

log.info(`*** XRPLMETA CRAWLER ***`)
log.info(`starting with config "${configPath}"`)

const config = loadConfig(configPath)
const repo = initRepo(config)


switch(args._[0]){
	case 'flush-wal': {
		log.info(`one-time flushing database WAL file...`)
		repo.flushWAL()
		process.exit(0)
		break
	}

	case 'work': {
		const task = args.task
		const xrpl = new Client()

		providers[task](
			context({config, repo, xrpl})
		)
		break
	}

	default: {
		const only = args.only ? args.only.split(',') : null
		const xrpl = new Host(config)
		const tasks = Object.keys(providers)
			.filter(key => !only || only.includes(key))


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
					`--config ${configPath}`,
					`--task`
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


