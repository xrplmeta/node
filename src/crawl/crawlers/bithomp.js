import log from '@mwni/log'
import { scheduleGlobal } from '../common/schedule.js'
import { createFetch } from '../../lib/fetch.js'
import { writeAccountProps } from '../../db/helpers/props.js'


export default async function({ ctx }){
	let config = ctx.config.crawl.bithomp
	
	let fetch = createFetch({
		baseUrl: 'https://bithomp.com/api/v2', 
		headers: {
			'x-bithomp-token': config.apiKey
		}
	})

	while(true){
		await scheduleGlobal({
			ctx,
			task: 'bithomp.services',
			interval: config.crawlInterval,
			routine: async () => {
				log.info(`fetching services list...`)

				let { data } = await fetch('services')
				let services = data.services
				let updatedAccounts = 0

				log.info(`got`, services.length, `services`)

				for(let service of services){
					for(let { address } of service.addresses){
						writeAccountProps({
							ctx,
							account: {
								address
							},
							props: {
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
							source: 'bithomp'
						})

						updatedAccounts++
					}
				}

				log.info(`updated`, updatedAccounts, `issuers`)
			}
		})
	}
}