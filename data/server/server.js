import crypto from 'crypto'
import HTTPWrapper from './http.js'
import WSWrapper from './ws.js'
import * as datasets from './datasets.js'
import { wait } from '../../common/time.js'
import { log } from '../../common/logging.js'

export default class Server{
	constructor({repo, config}){
		this.repo = repo
		this.config = config
		this.http = new HTTPWrapper(this)
		this.ws = new WSWrapper(this)
		this.cache = {}
		this.log = log.for('server', 'green')
	}

	async start(){
		this.log(`building essential dataset cache...`)
		await this.fillCache('currencies')
		this.log(`done`)

		this.http.listen(this.config.server.httpPort)
		this.ws.listen(this.config.server.wsPort)
	}

	makeCtx(parameters){
		return {
			repo: this.repo,
			dataset: this.serveDataset.bind(this),
			parameters
		}
	}

	async serveDataset(key, parameters){
		let xid = key + crypto.createHash('md5')
			.update(parameters ? JSON.stringify(parameters) : '') // might have to replace with something more steady
			.digest('base64')
			.slice(0, 8)

		let cached = this.cache[xid]

		if(cached){
			if(!cached.invalidate || !await cached.invalidate()){
				return cached.dataset
			}
		}

		let { dataset, invalidate } = await datasets[key]({
			repo: this.repo, 
			config: this.config, 
			parameters
		})

		this.cache[xid] = { dataset, invalidate }

		return dataset
	}

	async fillCache(key){
		await this.serveDataset(key)
	}
}

/*
for(let key of Object.getOwnPropertyNames(Procedures.prototype)){
			if(key === 'constructor')
				continue

			let procedureName = key.replace(/([A-Z])/g, match => '_' + match[0].toLowerCase())

			this.procedures[procedureName] = procedures[key].bind(procedures)
		}*/