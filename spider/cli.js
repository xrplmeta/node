import minimist from 'minimist'
import dotenv from 'dotenv'
import Repo from '../core/repo.js'
import Discovery from './discovery.js'


dotenv.config()

const args = minimist(process.argv.slice(2))
const repo = new Repo(process.env.DATA_DIR)
const discovery = new Discovery({repo, node: process.env.XRPL_NODE})


;(async () => {
	await repo.open()

	discovery.start(parseInt(process.env.DISCOVERY_INTERVAL))
})()