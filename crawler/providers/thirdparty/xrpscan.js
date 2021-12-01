import Rest from '../../lib/rest.js'
import { log } from '@xrplmeta/common/lib/log.js'
import { decodeAddress } from '@xrplmeta/common/lib/xrpl.js'


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
				try{
					decodeAddress(account)
				}catch{
					continue
				}

				metas.push({
					meta: {
						name,
						domain,
						verified: verified ? 'yes' : null,
						'socials.twitter': twitter,
					},
					account,
					source: 'xrpscan.com'
				})
			}

			log.info(`writing`, metas.length, `metas to db...`)

			await repo.metas.insert(metas)

			log.info(`well-known scan complete`)
		}
	)
}