import log from '@mwni/log'
import { scheduleBatchedIterator } from '../common/schedule.js'
import { createFetch } from '../../lib/fetch.js'
import { writeAccountProps } from '../../db/helpers/props.js'


export default async function({ ctx }){
	let config = ctx.config.crawl?.twitter

	if(!config){
		throw new Error(`disabled by config`)
	}
	
	let fetch = new createFetch({
		baseUrl: 'https://api.twitter.com/2',
		headers: {
			authorization: `Bearer ${config.bearerToken}`
		}, 
		ratelimit: config.maxRequestsPerMinute
	})

	while(true){
		await scheduleBatchedIterator({
			ctx,
			task: 'twitter',
			interval: config.crawlInterval,
			subjectType: 'issuer',
			batchSize: 100,
			iterator: {
				table: 'tokens',
				groupBy: ['issuer'],
				include: {
					issuer: true
				},
				where: {
					issuer: {
						props: {
							key: 'twitter'
						}
					}
				}
			},
			routine: async tokens => {
				let targets = {}

				for(let { issuer } of tokens){
					if(!issuer)
						continue

					let { value: twitterHandle } = ctx.db.accountProps.readOne({
						where: {
							account: issuer,
							key: 'twitter'
						}
					})

					if(!/^[A-Za-z0-9_]{1,15}$/.test(twitterHandle))
						continue

					if(!targets[twitterHandle])
						targets[twitterHandle] = []

					targets[twitterHandle].push(issuer)
				}

				let batch = Object.entries(targets)
					.map(([twitter, accounts]) => ({twitter, accounts}))

				if(batch.length === 0)
					return

				log.info(`got batch of`, batch.length, `twitter profiles to fetch`)

				let usernamesQuery = batch
					.map(({twitter}) => twitter)
					.join(',')

				let { status, data: {data, errors} } = await fetch(
					'users/by?user.fields=name,profile_image_url,description,entities,public_metrics'
					+ `&usernames=${encodeURIComponent(usernamesQuery)}`
				)

				if(status !== 200)
					throw `HTTP ${status}`
			
				if(!data){
					throw errors[0]
				}

				log.info(`fetched`, data.length, `profiles`)

				let updatedAccounts = 0

				for(let { twitter, accounts } of batch){
					let profile = data.find(entry => entry.username.toLowerCase() === twitter.toLowerCase())
					let props = {
						followers: undefined,
						name: undefined,
						icon: undefined,
						description: undefined,
						domain: undefined
					}


					if(profile){
						props.followers = profile.public_metrics.followers_count
						props.name = profile.name
						props.description = profile.description
						props.icon = profile.profile_image_url
							? profile.profile_image_url.replace('_normal', '')
							: undefined

						if(profile.entities?.url?.urls){
							props.domain = profile.entities.url.urls[0].expanded_url
								.replace(/^https?:\/\//, '')
								.replace(/\/$/, '')
						}

						if(profile.entities?.description?.urls){
							let offset = 0

							for(let {start, end, expanded_url} of profile.entities.description.urls){
								props.description = props.description.slice(0, start + offset) + expanded_url + props.description.slice(end + offset)
								offset += expanded_url.length - (end - start)
							}
						}
					}

					for(let account of accounts){
						writeAccountProps({
							ctx,
							account,
							props,
							source: 'twitter'
						})

						updatedAccounts++
					}
				}

				log.info(`updated`, updatedAccounts, `issuers`)
			}
		})
	}
}