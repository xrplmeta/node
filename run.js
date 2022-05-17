import minimist from 'minimist'
import log from '@mwni/log'
import { find as findConfig } from './lib/config.js'
import { load as loadConfig } from './lib/config.js'
import { override as overrideConfig } from './lib/config.js'
import startApp from './app/main.js'



const args = minimist(process.argv.slice(2))
const configPath = args.config
	? args.config
	: findConfig()

	
log.config({ severity: args.log || 'info' })
log.info(`*** XRPLMETA NODE ***`)
log.info(`using config at "${configPath}"`)


const baseConfig = loadConfig(configPath, true)
const config = overrideConfig(baseConfig, args)

log.info(`data directory is at "${config.data.dir}"`)
log.info(`will start app now`)

const app = await startApp({ config })

process.on('SIGINT', () => {
	app.terminate()
	process.exit(0)
})