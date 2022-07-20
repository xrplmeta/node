import log from '@mwni/log'
import { scheduleBatchedIterator } from '../common/schedule.js'
import { createFetch } from '../../lib/fetch.js'
import { writeAccountProps, writeTokenProps } from '../../db/helpers/props.js'


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
				include: {
					issuer: true
				},
				where: {
					OR: [
						{
							props: {
								key: 'weblinks'
							}
						},
						{
							issuer: {
								props: {
									key: 'weblinks'
								}
							}
						}
					]
				}
			},
			accumulate: (tasks, token) => {
				if(!token.issuer)
					return

				let issuerWeblinks = ctx.db.accountProps.readMany({
					where: {
						account: token.issuer,
						key: 'weblinks'
					}
				})

				let tokenWeblinks = ctx.db.tokenProps.readMany({
					where: {
						token,
						key: 'weblinks'
					}
				})

				for(let prop of [...issuerWeblinks, ...tokenWeblinks]){
					let link = prop.value
						.filter(link => link.type === 'socialmedia')
						.find(link => link.url.includes('twitter.com'))

					if(!link)
						continue

					let handle = link.url.split('/')[3]

					if(!handle)
						continue

					if(!/^[A-Za-z0-9_]{1,15}$/.test(handle))
						continue

					let task = tasks.find(task => task.handle === handle)

					if(!task){
						tasks.push(task = {
							handle,
							items: [],
							issuers: [],
							tokens: []
						})
					}

					task.items.push(token)

					if(prop.token){
						task.tokens.push(prop.token)
					}else{
						task.issuers.push(prop.account)
					}
				}

				return tasks
			},
			commit: async tasks => {
				console.log('tasks:', tasks)

				log.info(`got batch of`, tasks.length, `twitter profiles to fetch`)

				let usernamesQuery = tasks
					.map(({ handle }) => handle)
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

				let updatedTokens = 0
				let updatedAccounts = 0

				for(let { handle, tokens, issuers } of tasks){
					let profile = data.find(entry => entry.username.toLowerCase() === handle.toLowerCase())
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

							for(let { start, end, expanded_url } of profile.entities.description.urls){
								props.description = props.description.slice(0, start + offset) + expanded_url + props.description.slice(end + offset)
								offset += expanded_url.length - (end - start)
							}
						}
					}

					for(let token of tokens){
						writeTokenProps({
							ctx,
							token,
							props,
							source: 'twitter'
						})

						updatedTokens++
					}

					for(let account of issuers){
						writeAccountProps({
							ctx,
							account,
							props,
							source: 'twitter'
						})

						updatedAccounts++
					}
				}

				log.info(`updated`, updatedAccounts, `issuers and`, updatedTokens, `tokens`)
			}
		})
	}
}