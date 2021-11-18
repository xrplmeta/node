import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'
import { fileURLToPath } from 'url'
import minimist from 'minimist'
import { Logger } from './lib/log.js'
import { load as loadConfig } from './core/config.js'
import Repo from './core/repo.js'
import { Host, Client } from './core/xrpl.mt.js'
import Server from './server/server.js'
import providers from './providers/index.js'


if(isMainThread){
	const log = new Logger({name: 'main', color: 'yellow', level: 'info'})
	const args = minimist(process.argv.slice(2))
	const only = args.only ? args.only.split(',') : null
	const configPath = args.config || 'config.toml'


	log.info(`starting with config "${configPath}"`)

	const config = loadConfig(configPath)
	const repo = new Repo(config)
	const xrpl = new Host(config)
	const tasks = [...Object.keys(providers), 'server']
		.filter(key => !only || only.includes(key))


	log.info('spawning threads...')

	for(let task of tasks){
		let worker = new Worker(
			fileURLToPath(import.meta.url), 
			{
				workerData: {task, config}
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

