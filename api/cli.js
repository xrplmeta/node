import minimist from 'minimist'
import { Logger, log as defaultLogger } from '@xrplmeta/common/lib/log.js'
import { load as loadConfig } from '@xrplmeta/common/core/config.js'
import initRepo from '@xrplmeta/common/core/repo.js'
import initCache from './data/cache.js'
import initSync from './data/sync.js'
import initServer from './server/server.js'


const args = minimist(process.argv.slice(2))
const log = new Logger({name: 'main', color: 'yellow', level: args.log || 'info'})
const configPath = args.config || 'config.toml'
	
defaultLogger.level = log.level

log.info(`*** XRPLMETA API SERVER ***`)
log.info(`starting with config "${configPath}"`)

const config = loadConfig(configPath)
const repo = initRepo({...config, readonly: false})
const cache = initCache(config)


await initSync({config, repo, cache})
await initServer({config, cache})