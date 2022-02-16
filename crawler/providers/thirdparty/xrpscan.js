import Rest from '../../lib/rest.js'
import log from '@xrplmeta/log'


export default ({repo, config, loopTimeTask}) => {
	let api = new Rest({
		base: 'https://api.xrpscan.com/api/v1'
	})

	loopTimeTask(
		{
			task: 'xrpscan.well-known',
			interval: config.xrpscan.refreshInterval
		},
		async t => {
			log.info(`fetching well-known list...`)

			let names = await api.get('names/well-known')
			let metas = []

			log.info(`got`, names.length, `names`)

			for(let {account, name, domain, twitter, verified} of names){
				metas.push({
					meta: {
						name,
						domain,
						twitter,
						xrpscan_verified: verified,
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
	)
}