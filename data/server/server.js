import HTTPWrapper from './http.js'
import WSWrapper from './ws.js'
import * as datasets from './datasets.js'
import { wait } from '../../common/time.js'
import { log } from '../../common/logging.js'

export default class Server{
	constructor({repo, config}){
		this.repo = repo
		this.config = config.server
		this.http = new HTTPWrapper(this)
		this.ws = new WSWrapper(this)
		this.cache = {}
		this.log = log.for('server', 'green')
	}

	async start(){
		this.log(`building essential dataset cache...`)
		await this.fillCache('currencies')
		this.log(`done`)

		this.http.listen(this.config.httpPort)
		this.ws.listen(this.config.wsPort)
	}

	makeCtx(parameters){
		return {
			repo: this.repo,
			dataset: this.serveDataset.bind(this),
			parameters
		}
	}

	async serveDataset(key, options){
		if(this.cache[key])
			return this.cache[key]

		let { dataset, invalidate } = await datasets[key](this.repo, options)

		this.cache[key] = dataset

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