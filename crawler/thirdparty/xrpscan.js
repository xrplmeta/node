import log from '../../lib/log.js'
import { createFetch } from '../../lib/http.js'
import { scheduleTimeRoutine } from '../routine.js'


export function willRun(config){
	return !!config.xrpscan
}


export function run({ repo, config }){
	let fetch = new createFetch({
		baseUrl: 'https://api.xrpscan.com/api/v1'
	})

	scheduleTimeRoutine({
		id: 'xrpscan.well-known',
		interval: config.xrpscan.refreshInterval,
		routine: async t => {
			log.info(`fetching well-known list...`)

			let { data } = await fetch('names/well-known')
			let metas = []

			log.info(`got`, data.length, `names`)

			for(let { account, name, domain, twitter, verified } of data){
				metas.push({
					meta: {
						name,
						domain,
						twitter,
						verified,
					},
					account,
					source: 'xrpscan'
				})
			}

			log.info(`writing`, metas.length, `metas to db...`)

			metas.forEach(meta => {
				try{
					repo.metas.insert(meta)
				}catch{
					//typo in address
				}
			})

			log.info(`well-known scan complete`)
		}
	})
}