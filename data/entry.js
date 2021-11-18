import { Worker, parentPort, workerData } from 'worker_threads'
import { log as l } from './lib/logging.js'
import Repo from './core/repo.js'
import Nodes from './core/nodes.js'
import Server from './server/server.js'
import providers from './providers/index.js'

const { config, task } = workerData


const repo = new Repo(config)
const nodes = new Nodes(config)


;(async () => {
	await repo.open()

	if(task === 'server'){
		new Server({repo, nodes, config})
			.start()
	}else{
		
	}

	for(let [key, provider] of activeProviders){
		new providers[key]({repo, nodes, config: config})
			.run()
	}
})()