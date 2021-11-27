import { RestProvider } from '../base.js'
import { log } from '../../../common/lib/log.js'



export default class extends RestProvider{
	constructor({repo, nodes, config}){
		super({
			base: 'https://api.xrpscan.com/api/v1'
		})

		this.repo = repo
		this.nodes = nodes
		this.config = config.xrpscan
	}

	run(){
		this.loopOperation(
			'xrpscan.assets', 
			null,
			this.config.refreshInterval, 
			this.refresh.bind(this)
		)
	}

	async refresh(){
		log.info(`fetching names list...`)

		let names = await this.api.get('names/well-known')
		let metas = []

		log.info(`got`, names.length, `names`)

		for(let {account, name, domain, twitter, verified} of names){
			metas.push({
				meta: {
					name,
					domain,
					verified: verified ? 'yes' : null,
					'socials.twitter': twitter,
				},
				type: 'issuer',
				subject: account,
				source: 'xrpscan.com'
			})
		}

		log.info(`writing`, metas.length, `metas to db...`)

		await this.repo.metas.set(metas)

		log.info(`name scan complete`)
	}
}