import minimist from 'minimist'
import dotenv from 'dotenv'
import Repo from './repo.js'
import Discovery from './discovery.js'


const args = minimist(process.argv.slice(2))

dotenv.config()


const repo = new Repo(process.env.DATA_DIR)


;(async () => {
	await repo.open()

	if(run.includes('ticker'))
		ticker.start()

	if(run.includes('sync'))
		sync.start()

	if(run.includes('server')){
		server.listen(process.env.PORT)
	}
})()