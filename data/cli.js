import minimist from 'minimist'
import { log } from '../common/logging.js'
import { load as loadConfig } from './core/config.js'
import Repo from './core/repo.js'
import Nodes from './core/nodes.js'
import providers from './providers/index.js'


const args = minimist(process.argv.slice(2))
const only = args.only ? args.only.split(',').map(str => str.trim()) : null
const configPath = args.config || 'config.toml'

log({name: 'cli', color: 'green'}, `starting with config "${configPath}"`)

const config = loadConfig(configPath)
const repo = new Repo(config.data)
const nodes = new Nodes(config.nodes)


;(async () => {
	await repo.open()

	for(let [key, provider] of Object.entries(providers)){
		if(only && !only.includes(key))
			continue

		log({name: 'cli', color: 'green'}, `running provider ${key}`)

		let provider = new providers[key]({repo, nodes, config: config[key]})

		provider.run()
	}
})()