import log from '@mwni/log'
import { scheduleGlobal, scheduleIterator } from '../schedule.js'
import { createFetch } from '../../lib/fetch.js'
import { diffAccountsProps, diffTokensProps, writeAccountProps } from '../../db/helpers/props.js'


export default async function({ ctx }){
	let config = ctx.config.crawl?.xumm

	if(!config){
		throw new Error(`disabled by config`)
	}
	
	let fetchApi = createFetch({
		baseUrl: 'https://xumm.app/api/v1/platform/',
		headers: {
			'x-api-key': config.apiKey, 
			'x-api-secret': config.apiSecret
		},
		ratelimit: config.maxRequestsPerMinute
	})

	let fetchAvatar = createFetch({
		baseUrl: 'https://xumm.app/avatar/',
		ratelimit: config.maxRequestsPerMinute 
	})

	await Promise.all([
		crawlAssets({
			ctx,
			fetch: fetchApi,
			interval: config.crawlIntervalAssets
		}),
		crawlKyc({
			ctx,
			fetch: fetchApi,
			interval: config.crawlIntervalKyc
		}),
		crawlAvatar({
			ctx,
			fetch: fetchAvatar,
			interval: config.crawlIntervalAvatar
		})
	])
}

async function crawlAssets({ ctx, fetch, interval }){
	while(true){
		await scheduleGlobal({
			ctx,
			task: 'xumm.curated',
			interval,
			routine: async () => {
				log.info(`fetching curated asset list...`)

				let tokens = []
				let accounts = []

				let { data } = await fetch('curated-assets')

				if(!data?.details){
					log.warn(`got malformed XUMM curated asset list:`, data)
					throw new Error(`malformed response`)
				}

				log.info(`got ${Object.values(data.details).length} curated assets`)

				for(let issuer of Object.values(data.details)){
					for(let currency of Object.values(issuer.currencies)){
						accounts.push({
							address: currency.issuer,
							props: {
								name: issuer.name.length > 0
									? issuer.name
									: undefined,
								domain: issuer.domain,
								icon: issuer.avatar,
								trust_level: (
									issuer.info_source.type === 'native'
										? (issuer.shortlist ? 3 : 2)
										: 1
								)
							}
						})
						
						tokens.push({
							currency: currency.currency,
							issuer: {
								address: currency.issuer
							},
							props: {
								name: currency.name > 0
									? currency.name
									: undefined,
								icon: currency.avatar,
								trust_level: (
									currency.info_source.type === 'native'
										? (currency.shortlist ? 3 : 2)
										: 1
								)
							}
						})
					}
				}

				diffAccountsProps({ 
					ctx, 
					accounts,
					source: 'xumm/curated'
				})

				diffTokensProps({
					ctx, 
					tokens,
					source: 'xumm/curated'
				})

				log.info(`updated`, tokens.length, `tokens and`, accounts.length, `issuers`)
			}
		})
	}
}


async function crawlKyc({ ctx, fetch, interval }){
	while(true){
		await scheduleIterator({
			ctx,
			task: 'xumm.kyc',
			interval,
			subjectType: 'issuer',
			iterator: {
				table: 'tokens',
				groupBy: ['issuer'],
				include: {
					issuer: true
				}
			},
			routine: async token => {
				if(!token.issuer)
					return

				log.debug(`checking KYC for ${token.issuer.address}`)

				let { data } = await fetch(`kyc-status/${token.issuer.address}`)

				writeAccountProps({
					ctx,
					account: token.issuer,
					props: {
						kyc: data.kycApproved
					},
					source: 'xumm/kyc'
				})

				log.debug(`KYC for ${token.issuer.address}: ${data.kycApproved}`)
	
				log.accumulate.info({
					text: [`%kycChecked KYC checked in %time`],
					data: {
						kycChecked: 1
					}
				})
			}
		})
	}
}

async function crawlAvatar({ ctx, fetch, interval }){
	while(true){
		await scheduleIterator({
			ctx,
			task: 'xumm.avatar',
			interval,
			subjectType: 'issuer',
			iterator: {
				table: 'tokens',
				groupBy: ['issuer'],
				include: {
					issuer: true
				}
			},
			routine: async token => {
				if(!token.issuer)
					return

				log.debug(`checking avatar for ${token.issuer.address}`)

				let { headers } = await fetch(
					`${token.issuer.address}.png`, 
					{
						redirect: 'manual'
					}
				)

				let avatar = headers.get('location')
					? headers.get('location').split('?')[0]
					: undefined
	
				writeAccountProps({
					ctx,
					account: token.issuer,
					props: {
						icon: avatar
					},
					source: 'xumm/avatar'
				})

				log.debug(`avatar for ${token.issuer.address}: ${avatar}`)
				
				log.accumulate.info({
					text: [`%avatarsChecked avatars checked in %time`],
					data: {
						avatarsChecked: 1
					}
				})
			}
		})
	}
}