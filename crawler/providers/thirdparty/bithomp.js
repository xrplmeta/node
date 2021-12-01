import Rest from '../../lib/rest.js'
import { log } from '@xrplmeta/common/lib/log.js'
import { wait } from '@xrplmeta/common/lib/time.js'


export default ({repo, config, loopTimeTask}) => {
	let api = new Rest({
		base: 'https://bithomp.com/api/v2', 
		headers: {'x-bithomp-token': config.bithomp.apiKey}
	})

	loopTimeTask(
		{
			task: 'bithomp.assets',
			interval: config.bithomp.refreshInterval
		},
		async t => {
			log.info(`fetching services list...`)

			let result = await api.get('services')
			let services = result.services
			let metas = []

			log.info(`got`, services.length, `services`)

			for(let service of services){
				let meta = {
					name: service.name,
					domain: service.domain
				}

				if(service.socialAccounts){
					for(let [social, locator] of Object.entries(service.socialAccounts)){
						meta[`socials.${social}`] = locator
					}
				}

				for(let { address } of service.addresses){
					metas.push({
						account: address,
						meta,
						source: 'bithomp.com'
					})
				}
			}

			log.info(`writing`, metas.length, `metas to db...`)

			await repo.metas.insert(metas)

			log.info(`asset scan complete`)
		}
	)
}