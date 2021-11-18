import Koa from 'koa'
import websocket from 'koa-easy-ws'
import { log } from '../lib/log.js'
import HTTPRouter from './http.js'
import WSManager from './ws.js'
import datasets from './datasets/index.js'


export default class Server{
	constructor({repo, config}){
		this.repo = repo
		this.config = config
		this.datasets = {}
		this.koa = new Koa()
		this.router = new HTTPRouter({repo, config, datasets: this.datasets})
		this.ws = new WSManager({repo, config, datasets: this.datasets})

		for(let [key, datasetClass] of Object.entries(datasets)){
			this.datasets[key] = new datasetClass({repo, config, datasets: this.datasets})
		}
	}

	async start(){
		log.info(`building essential datasets`)
	
		for(let [key, dataset] of Object.entries(this.datasets)){
			let last = 0

			await dataset.init(progress => {
				if(progress - last >= 0.1){
					last = Math.floor(progress*10)/10
					log.info(`building ${key}: ${Math.round(last * 100)}%`)
				}
			})

			log.info(`building ${key}: complete`)
		}

		this.koa.use(websocket())
		this.koa.use(async (ctx, next) => {
			if(ctx.ws){
				this.ws.register(await ctx.ws())
			}else{
				return await next(ctx)
			}
		})
		this.koa.use(this.router.routes(), this.router.allowedMethods())
		this.koa.listen(this.config.api.port)

		log.info(`listening on port ${this.config.api.port}`)
	}

	makeCtx(parameters){
		return {
			repo: this.repo,
			datasets: this.datasets,
			parameters
		}
	}
}