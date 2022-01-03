import Rest from '../../lib/rest.js'
import log from '@xrplmeta/log'


export default ({repo, config, loopTimeTask, count}) => {
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

			if(emailHash){
				let res = await api.get(`avatar/${emailHash.toLowerCase()}`, {d: 404}, {raw: true})

				if(res.status === 200){
					meta.icon = `https://www.gravatar.com/avatar/${emailHash.toLowerCase()}`
				}else if(res.status !== 404){
					throw `HTTP ${res.status}`
				}

				count(`checked % avatars`)
			}
				

			await repo.metas.insert({
				meta,
				account: accountId,
				source: 'gravatar.com'
			})
		}
	)
}