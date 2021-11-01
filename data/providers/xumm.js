import fetch from 'node-fetch'
import Rest from '../../common/rest.js'
import { wait } from '../../common/time.js'
import { log, pretty } from '../../common/logging.js'



export default class{
	constructor({repo, key, secret}){
		this.repo = repo
		this.api = new Rest({base: 'https://xumm.app/api/v1', headers: {'x-api-key': key, 'x-api-secret': secret}, fetch})
		this.log = log.for({name: 'xumm', color: 'cyan'})
	}

	async runAssetScan(interval){
		while(true){
			await wait(1000)

			if(!await this.repo.isOperationDue('xumm-assets', '*', interval))
				continue

			await this.repo.recordOperation('xumm-assets', '*', this.scanAssets())
		}
	}

	async runKYCScan(interval){
		while(true){
			let todo = await this.repo.getNextDueIssuerForOperation('xumm-kyc', interval)

			if(!todo){
				await wait(1000)
				continue
			}

			await this.repo.recordOperation('xumm-kyc', todo.issuer, this.checkKYC(todo))
		}
	}


	async scanAssets(){
		this.log(`fetching curated asset list...`)

		let { details } = await this.api.get('platform/curated-assets')
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

	async checkKYC({issuer}){
		this.log(`checking KYC for ${issuer}`)

		let { kycApproved } = await this.api.get(`platform/kyc-status/${issuer}`)
		let meta = {kyc: kycApproved ? 'approved' : null}

		this.repo.setMeta({
			meta,
			type: 'issuer',
			subject: issuer,
			source: 'gravatar.com'
		})
	}
}