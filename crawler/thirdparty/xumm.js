import log from '../../lib/log.js'
import { createFetch } from '../../lib/http.js'
import { decode as decodeCurrency } from '@xrplworks/currency'
import { scheduleTimeRoutine } from '../routine.js'


export function willRun(config){
	return !!config.xumm
}

export function run({ config, repo }){
	let fetchApi = createFetch({
		baseUrl: 'https://xumm.app/api/v1/platform/',
		headers: {
			'x-api-key': config.xumm.apiKey, 
			'x-api-secret': config.xumm.apiSecret
		},
		ratelimit: config.xumm.maxRequestsPerMinute
	})

	let fetchAvatar = createFetch({
		baseUrl: 'https://xumm.app/avatar/',
		ratelimit: config.xumm.maxRequestsPerMinute 
	})

	scheduleTimeRoutine({
		id: 'xumm.assets',
		interval: config.xumm.refreshIntervalAssets,
		routine: async t => {
			log.info(`fetching curated asset list...`)

			let { data } = await fetchApi('curated-assets')
			let metas = []

			log.info(`got ${Object.values(data.details).length} issuers`)

			for(let issuer of Object.values(data.details)){
				for(let currency of Object.values(issuer.currencies)){
					metas.push({
						meta: {
							name: issuer.name,
							domain: issuer.domain,
							icon: issuer.avatar,
							trusted: true
						},
						account: currency.issuer,
						source: 'xumm'
					})

					metas.push({
						meta: {
							name: currency.name,
							icon: currency.avatar,
							trusted: true
						},
						token: {
							currency: decodeCurrency(currency.currency),
							issuer: currency.issuer
						},
						source: 'xumm'
					})
				}
			}

			log.info(`writing`, metas.length, `metas to db...`)

			metas.forEach(meta => repo.metas.insert(meta))

			log.info(`asset scan complete`)
		}
	})

	scheduleTimeRoutine({
		id: 'xumm.kyc',
		interval: config.xumm.refreshIntervalKyc,
		forEvery: 'account',
		routine: async (t, accountId) => {
			let account = await repo.accounts.get({id: accountId})
			let { data } = await fetchApi(`kyc-status/${account.address}`)

			if(data.kycApproved){
				repo.metas.insert({
					meta: {
						kyc: true
					},
					account: account.id,
					source: 'xumm'
				})
			}

			return {'KYCs checked': 1}
		}
	})
	
	scheduleTimeRoutine({
		id: 'xumm.avatar',
		interval: config.xumm.refreshIntervalAvatar,
		forEvery: 'account',
		routine: async (t, accountId) => {
			let account = await repo.accounts.get({id: accountId})
			let { headers } = await fetchAvatar(
				`${account.address}.png`, 
				{redirect: 'manual'}
			)

			if(headers.get('location')){
				repo.metas.insert({
					meta: {
						icon: headers.get('location').split('?')[0]
					},
					account: account.id,
					source: 'xumm'
				})
			}

			return {'avatars checked': 1}
		}
	})
}