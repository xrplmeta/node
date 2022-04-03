import { createFetch } from '../../lib/http.js'
import { accumulate as accumulateUpdates } from '../../lib/status.js'
import { scheduleTimeRoutine } from '../routine.js'


export function willRun(config){
	return !!config.gravatar
}


export function run({ repo, config }){
	let fetch = new createFetch({
		baseUrl: 'https://www.gravatar.com',
		ratelimit: config.gravatar.maxRequestsPerMinute
	})

	scheduleTimeRoutine({
		id: 'gravatar',
		interval: config.gravatar.refreshInterval,
		forEvery: 'account',
		routine: async (t, accountId) => {
			let { emailHash } = await repo.accounts.get({id: accountId})
			let meta = {icon: undefined}

			if(emailHash){
				let { status } = await fetch(`avatar/${emailHash.toLowerCase()}?d=404`)

				if(status === 200){
					meta.icon = `https://www.gravatar.com/avatar/${emailHash.toLowerCase()}`
				}else if(status !== 404){
					throw `HTTP ${status}`
				}
			}

			await repo.metas.insert({
				meta,
				account: accountId,
				source: 'gravatar'
			})

			accumulateUpdates({'avatars checked': 1})
		}
	})
}