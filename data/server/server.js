import Koa from 'koa'
import websocket from 'koa-easy-ws'
import HTTPRouter from './http.js'
import * as datasets from './datasets/index.js'
import { subscribe } from '../core/updates.js'
import { log } from '../../common/logging.js'

export default class Server{
	constructor({repo, config}){
		this.repo = repo
		this.config = config
		this.datasets = {}
		this.koa = new Koa()
		this.router = new HTTPRouter({repo, config, datasets: this.datasets})
		this.log = log.for('server', 'green')

		for(let [key, datasetClass] of Object.entries(datasets)){
			this.datasets[key] = new datasetClass({repo, config})
		}
	}

	async start(){
		this.log(`building essential datasets`)
	
		for(let dataset of Object.values(this.datasets)){
			await dataset.init()
		}

		subscribe(this.repo, updates => {
			for(let dataset of Object.values(this.datasets)){
				dataset.handleUpdates(updates)
			}
		})

		this.koa.use(async (ctx, next) => {
			if(ctx.ws){


				return ctx.ws.send('hello')
			}else{
				return await next(ctx)
			}
		})
		this.koa.use(this.router.routes(), this.router.allowedMethods())
		this.koa.listen(this.config.api.port)

		this.log(`listening on port ${this.config.api.port}`)
	}

	makeCtx(parameters){
		return {
			repo: this.repo,
			datasets: this.datasets,
			parameters
		}
	}
}