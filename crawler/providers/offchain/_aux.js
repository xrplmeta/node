import Rest from '../../lib/rest.js'
import { parse as parseXLS25 } from '../../standards/xls25.js'
import log from '@xrplmeta/log'
import { currencyHexToUTF8 } from '@xrplmeta/utils'


export default ({repo, config, loopTimeTask}) => {
	if(!config.aux)
		return

	for(let aux of config.aux){
		let api = new Rest({
			base: aux.url
		})

		log.info(`will read ${aux.url} every ${aux.refreshInterval} seconds`)

		loopTimeTask(
			{
				task: `aux.${aux.name}`,
				interval: aux.refreshInterval
			},
			async t => {
				log.info(`reading ${aux.url}`)


				let response = await api.get('.', null, {raw: true})
			
				if(!response.ok){
					throw `HTTP ${response.status}`
				}

				let toml = await response.text()
				let { issuers, currencies } = parseXLS25(toml)
				let metas = []

				for(let { address, ...meta } of issuers){
					metas.push({
						meta,
						account: address,
						source: aux.name
					})
				}

				for(let { code, issuer, ...meta } of currencies){
					metas.push({
						meta,
						token: {
							currency: currencyHexToUTF8(code),
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
		)
	}
}