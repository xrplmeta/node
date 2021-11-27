import minimist from 'minimist'
import { Logger, log as defaultLogger } from '../common/lib/log.js'
import { load as loadConfig } from '../common/core/config.js'
import Repo from '../common/core/repo.js'
import Server from './server/server.js'


const args = minimist(process.argv.slice(2))
const log = new Logger({name: 'main', color: 'yellow', level: args.log || 'info'})
const configPath = args.config || 'config.toml'
	
defaultLogger.level = log.level

log.info(`*** XRPLMETA API SERVER ***`)
log.info(`starting with config "${configPath}"`)

const config = loadConfig(configPath)
const repo = new Repo(config)

repo.open()
	.then(() => new Server({repo, config}))
	.then(server => server.start())