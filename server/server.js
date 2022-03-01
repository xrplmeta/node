import minimist from 'minimist'
import log from '@xrplmeta/log'
import { load as loadConfig } from '@xrplmeta/toml'
import { assignDeep } from '@xrplmeta/utils'
import initRepo from '@xrplmeta/repo'
import initCache from './cache/cache.js'
import initSync from './sync/sync.js'
import initApi from './api/api.js'


const args = minimist(process.argv.slice(2))
const configPath = args.config || 'server.toml'
	
log.config({
	name: 'main',
	color: 'yellow',
	severity: args.log || 'info'
})

log.info(`*** XRPLMETA API SERVER ***`)
log.info(`starting with config "${configPath}"`)

const rawconf = loadConfig(configPath)
const config = assignDeep(rawconf, args)
const repo = initRepo({...config, readonly: false})
const cache = initCache(config)


await initSync({config, repo, cache})
await initApi({config, cache})