import log from '@mwni/log'
import { parse as parseXLS26 } from '@xrplkit/xls26'
import { scheduleGlobal } from '../common/schedule.js'
import { createFetch } from '../../lib/fetch.js'
import { writeAccountProps, writeTokenProps } from '../../db/helpers/props.js'


export default async function({ ctx }){
	let configs = ctx.config.crawl?.tokenlist

	if(!configs){
		throw new Error(`disabled by config`)
	}

	await Promise.all(
		configs.map(
			config => crawlList({ ctx, ...config })
		)
	)
}

async function crawlList({ ctx, id, url, crawlInterval = 600, trustLevel = 0 }){
	let fetch = createFetch({
		baseUrl: url,
		headers: {
			'user-agent': ctx.config.crawl?.userAgent ||
				'XRPL-Meta-Crawler (https://xrplmeta.org)'
		}
	})

	while(true){
		await scheduleGlobal({
			ctx,
			task: `tokenlist.${id}`,
			interval: crawlInterval,
			routine: async () => {
				log.info(`reading ${url}`)

				let { status, data } = await fetch()
			
				if(status !== 200){
					throw `${url}: HTTP ${response.status}`
				}

				try{
					var { issuers, tokens, issues } = parseXLS26(data)
				}catch(error){
					console.log(error)
					throw error
				}

				let issuerUpdates = 0
				let tokenUpdates = 0

				if(issues.length > 0){
					log.debug(`tokenlist [${id}] has issues: ${
						issues
							.map(issue => `  - ${issue}`)
							.join(`\n`)
					}`)
				}
				
				for(let { address, ...props } of issuers){
					if(props.hasOwnProperty('trust_level'))
						props.trust_level = Math.min(props.trust_level, trustLevel)

					writeAccountProps({
						ctx,
						account: {
							address
						},
						props,
						source: id
					})

					issuerUpdates++
				}

				for(let { currency, issuer, ...props } of tokens){
					if(props.hasOwnProperty('trust_level'))
						props.trust_level = Math.min(props.trust_level, trustLevel)

					writeTokenProps({
						ctx,
						token: {
							currency,
							issuer: {
								address: issuer
							}
						},
						props,
						source: id
					})

					tokenUpdates++
				}

				log.info(`tokenlist [${id}] synced (issuers: ${issuerUpdates} tokens: ${tokenUpdates})`)
			}
		})
	}
}