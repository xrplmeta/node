import log from '@mwni/log'
import { scheduleGlobal } from '../common/schedule.js'
import { createFetch } from '../../lib/fetch.js'
import { writeAccountProps, writeTokenProps } from '../../db/helpers/props.js'
import { parseXLS26 } from '../../lib/xls26.js'


export default async function({ ctx }){
	let configs = ctx.config.crawl?.auxlist

	if(!configs){
		throw new Error(`disabled by config`)
	}

	await Promise.all(
		configs.map(
			config => crawlList({ ctx, ...config })
		)
	)
}

async function crawlList({ ctx, id, url, trusted, crawlInterval }){
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
			task: `aux.${id}`,
			interval: crawlInterval,
			routine: async () => {
				log.info(`reading ${url}`)

				let { status, data } = await fetch()
			
				if(status !== 200){
					throw `${url}: HTTP ${response.status}`
				}

				let { issuers, tokens } = parseXLS26(data)
				let issuerUpdates = 0
				let tokenUpdates = 0
				
				for(let { address, ...props } of issuers){
					if(!trusted)
						delete props.trusted

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
					if(!trusted)
						delete props.trusted

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

				log.info(`auxlist [${id}] scanned (issuers: ${issuerUpdates} tokens: ${tokenUpdates})`)
			}
		})
	}
}