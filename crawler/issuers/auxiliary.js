import { createFetch } from '../../lib/http.js'
import { parse as parseXLS26 } from '../../lib/xls26.js'
import log from '../../lib/log.js'
import { decode as decodeCurrency } from '@xrplworks/currency'
import { scheduleTimeRoutine } from '../routine.js'


export function willRun(config){
	return !!config.aux
}

export function run({ config, repo }){
	for(let aux of config.aux){
		let fetch = createFetch({
			baseUrl: aux.url
		})

		log.info(`will read ${aux.url} every ${aux.refreshInterval} seconds`)

		scheduleTimeRoutine({
			id: `aux.${aux.name}`,
			interval: aux.refreshInterval,
			routine: async t => {
				log.info(`reading ${aux.url}`)

				let { status, data } = await fetch()
			
				if(status !== 200){
					throw `${aux.url}: HTTP ${response.status}`
				}

				let { issuers, tokens } = parseXLS26(data)
				let metas = []

				for(let { address, ...meta } of issuers){
					metas.push({
						meta,
						account: address,
						source: aux.name
					})
				}

				for(let { currency, issuer, ...meta } of tokens){
					metas.push({
						meta,
						token: {
							currency,
							issuer
						},
						source: aux.name
					})
				}

				if(!aux.trusted){
					for(let { meta } of metas){
						delete meta.trusted
					}
				}


				log.info(`writing`, metas.length, `metas to db...`)

				for(let meta of metas){
					repo.metas.insert(meta)
				}

				log.info(`${aux.name} aux scan complete`)
			}
		})
	}
}