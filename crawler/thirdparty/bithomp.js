import log from '../../lib/log.js'
import { createFetch } from '../../lib/http.js'
import { scheduleTimeRoutine } from '../routine.js'


export function willRun(config){
	return !!config.bithomp?.apiKey
}


export function run({ repo, config }){
	let fetch = createFetch({
		baseUrl: 'https://bithomp.com/api/v2', 
		headers: {
			'x-bithomp-token': config.bithomp.apiKey
		}
	})

	scheduleTimeRoutine({
		id: 'bithomp.assets',
		interval: config.bithomp.refreshInterval,
		routine: async t => {
			log.info(`fetching services list...`)

			let { data } = await fetch('services')
			let services = data.services
			let metas = []

			log.info(`got`, services.length, `services`)

			for(let service of services){
				for(let { address } of service.addresses){
					metas.push({
						meta: {
							...Object.entries(service.socialAccounts || {})
								.reduce(
									(accounts, [key, user]) => ({
										...accounts,
										[key]: user
									}),
									{}
								),
							name: service.name,
							domain: service.domain,
							...service.socialAccounts
						},
						account: address,
						source: 'bithomp'
					})
				}
			}

			log.info(`writing`, metas.length, `metas to db...`)

			metas.forEach(meta => repo.tokenMetas.insert(meta))

			log.info(`asset scan complete`)
		}
	})
}