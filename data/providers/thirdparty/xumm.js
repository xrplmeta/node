import { RestProvider } from '../base.js'
import { wait } from '../../../common/time.js'
import { log, pretty } from '../../../common/logging.js'



export default class extends RestProvider{
	constructor({repo, nodes, config}){
		super('xumm', {
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
		this.log = log.for('xumm', 'cyan')
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
		this.log(`fetching curated asset list...`)

		let { details } = await this.api.get('curated-assets')
		let metas = []

		this.log(`got ${Object.values(details).length} issuers`)

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
					type: 'currency',
					subject: `${currency.currency}:${currency.issuer}`,
					source: 'xumm.app'
				})
			}
		}

		this.log(`writing ${pretty(metas.length)} metas to db...`)

		await this.repo.setMetas(metas)

		this.log(`asset scan complete`)
	}

	async checkKYC(issuerId){
		let issuer = await this.repo.getIssuer({id: issuerId})

		this.log(`checking KYC for ${issuer.address}`)

		let { kycApproved } = await this.api.get(`kyc-status/${issuer.address}`)
		let meta = {kyc: kycApproved ? 'approved' : null}

		this.repo.setMeta({
			meta,
			type: 'issuer',
			subject: issuer.id,
			source: 'xumm.app'
		})
	}
}