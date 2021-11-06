import minimist from 'minimist'
import { log as l } from './lib/logging.js'
import { load as loadConfig } from './core/config.js'
import Repo from './core/repo.js'
import Nodes from './core/nodes.js'
import Server from './server/server.js'
import providers from './providers/index.js'


const log = l.for('cli', 'yellow')
const args = minimist(process.argv.slice(2))
const only = args.only ? args.only.split(',') : null
const configPath = args.config || 'config.toml'

log(`starting with config "${configPath}"`)

const config = loadConfig(configPath)
const repo = new Repo(config)
const nodes = new Nodes(config)
const server = new Server({repo, nodes, config})
const activeProviders = Object.entries(providers)
	.filter(([key, provider]) => !only || only.includes(key))


log(`will run data providers:`)

activeProviders.forEach(([key]) => log(`- ${key}`))

;(async () => {
	await repo.open()

	if(!only || only.includes('server'))
		await server.start()

	for(let [key, provider] of activeProviders){
		new providers[key]({repo, nodes, config: config})
			.run()
	}
})()