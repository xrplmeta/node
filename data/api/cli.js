import dotenv from 'dotenv'
import Server from './server.js'
import Repo from '../core/repo.js'

dotenv.config()

const repo = new Repo()
const server = new Server(repo)

;(async () => {
	await repo.open()

	server.listen(parseInt(process.env.PORT))
})()

