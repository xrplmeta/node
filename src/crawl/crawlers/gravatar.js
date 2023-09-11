import log from '@mwni/log'
import { scheduleIterator } from '../schedule.js'
import { createFetch } from '../../lib/fetch.js'
import { writeAccountProps } from '../../db/helpers/props.js'


export default async function({ ctx }){
	let config = ctx.config.source.gravatar

	if(!config || config.disabled){
		throw new Error(`disabled by config`)
	}
	
	let fetch = new createFetch({
		baseUrl: 'https://www.gravatar.com',
		ratelimit: config.maxRequestsPerMinute
	})

	while(true){
		await scheduleIterator({
			ctx,
			task: 'gravatar',
			interval: config.fetchInterval,
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

				let { emailHash } = token.issuer
				let icon
	
				if(emailHash){
					log.debug(`checking avatar for ${token.issuer.address}`)

					let { status } = await fetch(`avatar/${emailHash.toLowerCase()}?d=404`)
	
					if(status === 200){
						icon = `https://www.gravatar.com/avatar/${emailHash.toLowerCase()}`
					}else if(status !== 404){
						throw `HTTP ${status}`
					}

					log.debug(`avatar for ${token.issuer.address}: ${icon}`)
				}

				writeAccountProps({
					ctx,
					account: token.issuer,
					props: {
						icon
					},
					source: 'gravatar/avatar'
				})
	
				log.accumulate.info({
					text: [`%gravatarsChecked avatars checked in %time`],
					data: {
						gravatarsChecked: 1
					}
				})
			}
		})
	}
}