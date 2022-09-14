import minimist from 'minimist'
import log from '@mwni/log'
import { find as findConfig } from './lib/config.js'
import { load as loadConfig } from './lib/config.js'
import { override as overrideConfig } from './lib/config.js'
import startApp from './app/main.js'
import rebuildCache from './cmd/rebuild-cache.js'



const args = minimist(process.argv.slice(2))
const configPath = args.config
	? args.config
	: findConfig()

	
log.config({ severity: args.log || 'info' })
log.info(`*** XRPLMETA NODE ***`)
log.info(`using config at "${configPath}"`)


const baseConfig = loadConfig(configPath, true)
const config = overrideConfig(baseConfig, args)

if(args._[0] === 'rebuild-cache'){
	log.info(`rebuilding cache at "${config.data.dir}"`)
	await rebuildCache({ config })
}else{
	log.info(`data directory is at "${config.data.dir}"`)
	log.info(`will start app now`)

	const app = await startApp({ config })

	process.on('SIGINT', async () => {
		await app.terminate()
		process.exit(0)
	})
}