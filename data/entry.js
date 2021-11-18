import { Worker, parentPort, workerData } from 'worker_threads'
import Repo from './core/repo.js'
import { Client } from './core/xrpl.mt.js'
import Server from './server/server.js'
import providers from './providers/index.js'

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