import { RestProvider } from '../base.js'
import { wait } from '../../../common/time.js'
import { log } from '../../lib/log.js'


export default class extends RestProvider{
	constructor({repo, nodes, config}){
		super({
			base: 'https://xumm.app/api/v1/platform', 
			headers: {
				'x-api-key': config.xumm.apiKey, 
				'x-api-secret': config.xumm.apiSecret
			},
			ratelimit: config.xumm.maxRequestsPerMinute 
				? {
					tokensPerInterval: config.xumm.maxRequestsPerMinute, 
					interval: 'minute'
				}
				: null
		})

		this.repo = repo
		this.nodes = nodes
		this.config = config.xumm
	}

	run(){
		this.loopOperation(
			'xumm.assets', 
			null, 
			this.config.refreshIntervalAssets,
			this.scanAssets.bind(this)
		)

		this.loopOperation(
			'xumm.kyc', 
			'issuer', 
			this.config.refreshIntervalKyc,
			this.checkKYC.bind(this)
		)
	}



	async scanAssets(){
		log.info(`fetching curated asset list...`)

		let { details } = await this.api.get('curated-assets')
		let metas = []

		log.info(`got ${Object.values(details).length} issuers`)

		for(let issuer of Object.values(details)){
			for(let currency of Object.values(issuer.currencies)){
				metas.push({
					meta: {
						name: issuer.name,
						domain: issuer.domain,
						icon: issuer.avatar
					},
					type: 'issuer',
					subject: currency.issuer,
					source: 'xumm.app'
				})

				metas.push({
					meta: {
						name: currency.name,
						icon: currency.avatar
					},
					type: 'trustline',
					subject: currency,
					source: 'xumm.app'
				})
			}
		}

		log.info(`writing`, metas.length, `metas to db...`)

		await this.repo.metas.set(metas)

		log.info(`asset scan complete`)
	}

	async checkKYC(issuerId){
		let issuer = await this.repo.issuers.getOne({id: issuerId})

		let { kycApproved } = await this.api.get(`kyc-status/${issuer.address}`)
		let meta = {kyc: kycApproved ? 'approved' : null}

		this.repo.metas.setOne({
			meta,
			type: 'issuer',
			subject: issuer.id,
			source: 'xumm.app'
		})

		if(!this.status){
			this.status = {checked: 0, start: Date.now()}
		}else if(Date.now() - this.status.start > 10000){
			log.info(`checked ${this.status.checked+1} KYCs in 10s`)
			this.status = null
		}else{
			this.status.checked++
		}
	}
}