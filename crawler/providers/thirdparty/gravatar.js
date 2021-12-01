import Rest from '../../lib/rest.js'
import { log } from '@xrplmeta/common/lib/log.js'
import { decodeAddress } from '@xrplmeta/common/lib/xrpl.js'


export default ({repo, config, loopTimeTask}) => {
	let api = new Rest({
		base: 'https://www.gravatar.com',
		ratelimit: config.gravatar.maxRequestsPerMinute
	})

	loopTimeTask(
		{
			task: 'gravatar',
			interval: config.gravatar.refreshInterval,
			subject: 'A'
		},
		async (t, accountId) => {
			let { emailHash } = await repo.accounts.get({id: accountId})
			let meta = {icon: null}

			/*if(emailHash){
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
			}*/
				

			await repo.metas.insert([{
				meta,
				account: accountId,
				source: 'gravatar.com'
			}])
		}
	)
}