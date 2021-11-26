import { Worker, isMainThread, parentPort, workerData } from './lib/worker_threads.polyfill.js'
import { fileURLToPath } from 'url'
import minimist from 'minimist'
import { Logger, log as defaultLogger } from './lib/log.js'
import { load as loadConfig } from './core/config.js'
import Repo from './core/repo.js'
import { Host, Client } from './core/xrpl.mt.js'
import Server from './server/server.js'
import providers from './providers/index.js'


if(isMainThread){
	const args = minimist(process.argv.slice(2))
	const log = new Logger({name: 'main', color: 'yellow', level: args.log || 'info'})
	const configPath = args.config || 'config.toml'
	
	defaultLogger.level = log.level
	
	log.info(`starting with config "${configPath}"`)

	const config = loadConfig(configPath)
	const repo = new Repo(config)

	if(args._[0] === 'flush-wal'){
		log.info(`one-time flushing database WAL file...`)

		repo.open()
			.then(() => repo.flushWAL())
			.then(() => process.exit(0))
	}else{
		const only = args.only ? args.only.split(',') : null
		const xrpl = new Host(config)
		const tasks = [...Object.keys(providers), 'server']
			.filter(key => !only || only.includes(key))


		log.info('spawning threads...')

		for(let task of tasks){
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

			worker.on('message', ({type, data}) => {
				
			})

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

		repo.open()
			.then(() => repo.monitorWAL(60000, 100000000))
	}
}else{
	const { task, config } = workerData

	const repo = new Repo(config)
	const xrpl = new Client(parentPort)


	;(async () => {
		await repo.open()


		if(task === 'server'){
			new Server({repo, config})
				.start()
		}else{
			new providers[task]({repo, xrpl, config: config})
				.run()
		}
	})()
}

