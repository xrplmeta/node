import log from '@mwni/log'
import { scheduleGlobal } from '../common/schedule.js'
import { createFetch } from '../../lib/fetch.js'
import { writeTokenProps } from '../../db/helpers/props.js'


export default async function({ ctx }){
	let config = ctx.config.crawl?.xrplf

	if(!config){
		throw new Error(`disabled by config`)
	}
	
	let fetch = createFetch({
		baseUrl: 'https://assessments.api.xrplf.org/api/v1'
	})

	while(true){
		await scheduleGlobal({
			ctx,
			task: 'xrplf.assessments',
			interval: config.crawlInterval,
			routine: async () => {
				log.info(`fetching assessments list...`)

				let { data } = await fetch('all')
				let updatedTokens = 0

				log.info(`got`, data.length, `assessments`)

				for(let assessment of data){
					if(assessment.self_assessment){
						writeTokenProps({
							ctx,
							token: {
								issuer: {
									address: assessment.issuer
								},
								currency: assessment.currency_code
							},
							props: {
								self_assessment: true,
								weblinks: [{
									url: assessment.information,
									type: 'info',
									title: 'XRPL Foundation Self Assessment'
								}]
							},
							source: 'xrplf'
						})

						updatedTokens++
					}
				}

				log.info(`updated`, updatedTokens, `tokens`)
			}
		})
	}
}