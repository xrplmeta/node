import { RestProvider } from '../base.js'
import { log } from '../../lib/log.js'


export default class extends RestProvider{
	constructor({repo, nodes, config}){
		super({
			base: 'https://www.gravatar.com',
			ratelimit: config.gravatar.maxRequestsPerMinute 
				? {
					tokensPerInterval: config.gravatar.maxRequestsPerMinute, 
					interval: 'minute'
				}
				: null
		})

		this.repo = repo
		this.nodes = nodes
		this.config = config.gravatar
	}
 

	run(){
		this.loopOperation(
			'gravatar',
			'issuer',
			this.config.refreshInterval,
			this.update.bind(this)
		)
	}


	async update(issuerId){
		let emailHash = await this.repo.metas.getOne('issuer', issuerId, 'emailHash', 'ledger')
		let meta = {icon: null}

		if(emailHash){
			let res = await this.api.get(`avatar/${emailHash.toLowerCase()}`, {d: 404}, {raw: true})

			if(res.status === 200){
				meta.icon = `https://www.gravatar.com/avatar/${emailHash.toLowerCase()}`
			}else if(res.status !== 404){
				throw `HTTP ${res.status}`
			}

			if(!this.status){
				this.status = {checked: 0, start: Date.now()}
			}else if(Date.now() - this.status.start > 10000){
				log.info(`checked ${this.status.checked+1} avatars in 10s`)
				this.status = null
			}else{
				this.status.checked++
			}
		}
			

		await this.repo.metas.setOne({
			meta,
			type: 'issuer',
			subject: issuerId,
			source: 'gravatar.com'
		})
	}
}