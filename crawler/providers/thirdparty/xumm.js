import Rest from '../../lib/rest.js'
import log from '@xrplmeta/log'
import { currencyHexToUTF8 } from '@xrplmeta/utils'


export default ({repo, config, loopTimeTask, count}) => {
	let api = new Rest({
		base: 'https://xumm.app',
		headers: {
			'x-api-key': config.xumm.apiKey, 
			'x-api-secret': config.xumm.apiSecret
		},
		ratelimit: config.xumm.maxRequestsPerMinute 
	})

	loopTimeTask(
		{
			task: 'xumm.assets',
			interval: config.xumm.refreshIntervalAssets
		},
		async t => {
			log.info(`fetching curated asset list...`)

			let { details } = await api.get('api/v1/platform/curated-assets')
			let metas = []

			log.info(`got ${Object.values(details).length} issuers`)

			for(let issuer of Object.values(details)){
				for(let currency of Object.values(issuer.currencies)){
					metas.push({
						meta: {
							name: issuer.name,
							domain: issuer.domain,
							icon: issuer.avatar
						},
						account: currency.issuer,
						source: 'xumm.app'
					})

					metas.push({
						meta: {
							name: currency.name,
							icon: currency.avatar
						},
						token: {
							currency: currencyHexToUTF8(currency.currency),
							issuer: currency.issuer
						},
						source: 'xumm.app'
					})
				}
			}

			log.info(`writing`, metas.length, `metas to db...`)

			metas.forEach(meta => repo.metas.insert(meta))

			log.info(`asset scan complete`)
		}
	)

	loopTimeTask(
		{
			task: 'xumm.kyc',
			interval: config.xumm.refreshIntervalKYC,
			subject: 'A'
		},
		async (t, accountId) => {
			let account = await repo.accounts.get({id: accountId})

			let { kycApproved } = await api.get(`api/v1/platform/kyc-status/${account.address}`)
			let meta = {kyc: kycApproved ? 'approved' : null}

			repo.metas.insert({
				meta,
				account: account.id,
				source: 'xumm.app'
			})

			count(`checked % KYCs`)
		}
	)


	loopTimeTask(
		{
			task: 'xumm.avatar',
			interval: config.xumm.refreshIntervalAvatar,
			subject: 'A'
		},
		async (t, accountId) => {
			let account = await repo.accounts.get({id: accountId})
			let meta = {icon: null}
			let res = await api.get(
				`/avatar/${account.address}.png`, 
				null, 
				{raw: true, redirect: 'manual'}
			)


			if(res.headers.get('location')){
				meta.icon = res.headers.get('location').split('?')[0]
			}

			repo.metas.insert({
				meta,
				account: account.id,
				source: 'xumm.pro'
			})

			count(`checked % icons`)
		}
	)
}