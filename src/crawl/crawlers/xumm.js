import log from '@mwni/log'
import { scheduleGlobal, scheduleIterator } from '../common/schedule.js'
import { createFetch } from '../../lib/fetch.js'
import { writeAccountProps, writeTokenProps } from '../../db/helpers/props.js'


export default async function({ ctx }){
	let config = ctx.config.crawl.xumm
	
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
			interval: config.refreshIntervalAssets
		}),
		crawlKyc({
			ctx,
			fetch: fetchApi,
			interval: config.refreshIntervalKyc
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

				log.info(`got ${Object.values(data.details).length} issuers`)

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
								trusted: true
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
								trusted: true
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
			iterator: ctx.db.tokens.iter({
				groupBy: ['issuer'],
				include: {
					issuer: true
				}
			}),
			routine: async token => {
				if(!token.issuer)
					return

				try{
					let { data } = await fetch(`kyc-status/${token.issuer.address}`)

					writeAccountProps({
						ctx,
						account: token.issuer,
						props: {
							kyc: data.kycApproved
						},
						source: 'xumm'
					})
				}catch(error){
					log.warn(`could not fetch KYC:`, error.message)
					return
				}
				
	
				log.accumulate.info({
					text: [`%kycChecked KYCs checked in %time`],
					data: {
						kycChecked: 1
					}
				})
			}
		})
	}
}