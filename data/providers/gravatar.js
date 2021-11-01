import { RestProvider } from './base.js'
import { wait } from '../../common/time.js'
import { log, pretty } from '../../common/logging.js'



export default class extends RestProvider{
	constructor({repo, nodes, config}){
		super({base: 'https://www.gravatar.com'})

		this.repo = repo
		this.nodes = nodes
		this.config = config
		this.log = log.for('gravatar', 'cyan')
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
		let emailHash = await this.repo.getMeta('issuer', issuerId, 'emailHash', 'ledger')
		let meta = {icon: null}

		console.log('checking', issuerId)

		if(emailHash){
			this.log(`checking avatar ${emailHash}`)

			let res = await this.api.get(`avatar/${emailHash.toLowerCase()}`, {d: 404}, {raw: true})

			if(res.status === 200){
				meta.icon = `https://www.gravatar.com/avatar/${emailHash.toLowerCase()}`
			}else if(res.status !== 404){
				throw {message: `HTTP Error ${res.status}`}
			}
		}
			

		await this.repo.setMeta({
			meta,
			type: 'issuer',
			subject: issuerId,
			source: 'gravatar.com'
		})
	}
}