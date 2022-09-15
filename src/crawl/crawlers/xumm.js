import log from '@mwni/log'
import { scheduleGlobal, scheduleIterator } from '../common/schedule.js'
import { createFetch } from '../../lib/fetch.js'
import { writeAccountProps, writeTokenProps } from '../../db/helpers/props.js'


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
			task: 'xumm.assets',
			interval,
			routine: async () => {
				log.info(`fetching curated asset list...`)

				let { data } = await fetch('curated-assets')
				let updatedCurrencies = 0

				if(!data?.details){
					log.warn(`got malformed XUMM cureated asset list:`, data)
					throw new Error(`malformed response`)
				}

				log.info(`got ${Object.values(data.details).length} curated assets`)

				for(let issuer of Object.values(data.details)){
					for(let currency of Object.values(issuer.currencies)){
						writeAccountProps({
							ctx,
							account: {
								address: currency.issuer
							},
							props: {
								name: issuer.name,
								domain: issuer.domain,
								icon: issuer.avatar,
								trust_level: (
									issuer.info_source.type === 'native'
										? (issuer.shortlist ? 3 : 2)
										: 1
								)
							},
							source: 'xumm'
						})

						writeTokenProps({
							ctx,
							token: {
								currency: currency.currency,
								issuer: {
									address: currency.issuer
								}
							},
							props: {
								name: currency.name,
								icon: currency.avatar,
								trust_level: (
									currency.info_source.type === 'native'
										? (currency.shortlist ? 3 : 2)
										: 1
								)
							},
							source: 'xumm'
						})

						updatedCurrencies++
					}
				}

				log.info(`updated`, updatedCurrencies, `tokens`)
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

				let { data } = await fetch(`kyc-status/${token.issuer.address}`)

				writeAccountProps({
					ctx,
					account: token.issuer,
					props: {
						kyc: data.kycApproved
					},
					source: 'xumm'
				})
	
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

				let { headers } = await fetch(
					`${token.issuer.address}.png`, 
					{
						redirect: 'manual'
					}
				)
	
				writeAccountProps({
					ctx,
					account: token.issuer,
					props: {
						icon: headers.get('location')
							? headers.get('location').split('?')[0]
							: undefined
					},
					source: 'xumm'
				})
				
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