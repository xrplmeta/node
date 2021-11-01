import { RestProvider } from './base.js'
import { wait } from '../../common/time.js'
import { log, pretty } from '../../common/logging.js'



export default class extends RestProvider{
	constructor({repo, nodes, config}){
		super({base: 'https://bithomp.com/api/v2', headers: {'x-bithomp-token': config.apiKey}})

		this.repo = repo
		this.nodes = nodes
		this.config = config
		this.log = log.for('bithomp', 'cyan')
	}

	run(){
		this.loopOperation(
			'bithomp-assets', 
			null,
			this.config.refreshInterval, 
			this.refresh.bind(this)
		)
	}

	async refresh(){
		this.log(`fetching services list...`)

		let result = await this.api.get('services')
		let services = result.services
		let metas = []

		this.log(`got ${services.length} services`)

		for(let service of services){
			let meta = {
				name: service.name,
				domain: service.domain
			}


			if(service.socialAccounts){
				for(let [social, locator] of Object.entries(service.socialAccounts)){
					meta[`socials.${social}`] = locator
				}
			}

			for(let { address } of service.addresses){
				metas.push({
					meta,
					type: 'issuer',
					subject: address,
					source: 'bithomp.com'
				})
			}
		}

		this.log(`writing ${pretty(metas.length)} metas to db...`)

		await this.repo.setMetas(metas)

		this.log(`asset scan complete`)
	}
}