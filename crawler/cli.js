import { Worker, isMainThread, parentPort, workerData } from '@xrplmeta/common/lib/worker_threads.polyfill.js'
import { fileURLToPath } from 'url'
import minimist from 'minimist'
import { Logger, log as defaultLogger } from '@xrplmeta/common/lib/log.js'
import { load as loadConfig } from '@xrplmeta/common/core/config.js'
import initRepo from '@xrplmeta/common/core/repo.js'
import { Host, Client } from './nodes/adapter.js'
import context from './providers/context.js'
import providers from './providers/index.js'


if(isMainThread){
	const args = minimist(process.argv.slice(2))
	const log = new Logger({name: 'main', color: 'yellow', level: args.log || 'info'})
	const configPath = args.config || 'config.toml'
	
	defaultLogger.level = log.level
	
	log.info(`*** XRPLMETA CRAWLER ***`)
	log.info(`starting with config "${configPath}"`)

	const config = loadConfig(configPath)
	const repo = initRepo(config)

	if(args._[0] === 'flush-wal'){
		log.info(`one-time flushing database WAL file...`)
		repo.flushWAL()
		process.exit(0)
	}else{
		const only = args.only ? args.only.split(',') : null
		const xrpl = new Host(config)
		const tasks = Object.keys(providers)
			.filter(key => !only || only.includes(key))


		log.info('spawning threads...')

		for(let task of tasks){
			if(config[task]?.disabled){
				log.info(`task [${task}] is disabled by config`)
				continue
			}

			let worker = new Worker(
				fileURLToPath(import.meta.url), 
				{
					workerData: {task, config},
					resourceLimits: {
						maxYoungGenerationSizeMb: 10000,
						maxOldGenerationSizeMb : 10000,
					}
				}
			)

			xrpl.register(worker)
			log.registerWorker(worker, {name: task, color: 'cyan'})

			worker.on('error', error => {
				log.error(`thread [${task}] encountered error:`)
				log.error(error)
				xrpl.discard(worker)
			})

			worker.on('exit', code => {
				log.error(`thread [${task}] exited with code ${code}`)
				xrpl.discard(worker)
			})

			log.info(`spawned [${task}]`)
		}

		log.info(`all threads up`)

		repo.monitorWAL(60000, 100000000)
	}
}else{
	const { task, config } = workerData

	const repo = initRepo(config)
	const xrpl = new Client(parentPort)


	providers[task](
		context({config, repo, xrpl})
	)
}

