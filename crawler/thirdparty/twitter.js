import log from '../../lib/log.js'
import { createFetch } from '../../lib/http.js'
import { batched } from '../../lib/utils.js'
import { scheduleTimeRoutine } from '../routine.js'


export function willRun(config){
	return !!config.twitter?.bearerToken
}


export function run({ repo, config }){
	let fetch = createFetch({
		baseUrl: 'https://api.twitter.com/2',
		headers: {
			authorization: `Bearer ${config.twitter.bearerToken}`
		},
		ratelimit: config.twitter.maxRequestsPerMinute 
	})

	scheduleTimeRoutine({
		id: 'twitter.meta',
		interval: config.twitter.refreshInterval,
		routine: async t => {
			log.info(`collecting targets`)

			let targets = {}

			for(let { id } of repo.accounts.all()){
				let meta = repo.tokenMetas.get({account: id, key: 'twitter'})
				let twitter = meta?.value

				if(!twitter)
					continue

				if(!/^[A-Za-z0-9_]{1,15}$/.test(twitter))
					continue

				if(!targets[twitter])
					targets[twitter] = []

				targets[twitter].push(id)
			}

			let targetTodo = Object.entries(targets)
				.map(([twitter, accounts]) => ({twitter, accounts}))

			let targetBatches = batched(targetTodo, 100)
			let i = 0

			log.info(`got`, targetTodo.length, `twitter pages to scrape (${targetBatches.length} batches)`)

			for(let batch of targetBatches){
				log.info(`collecting batch ${i} of ${targetBatches.length}`)

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

				log.info(`got`, data.length, `profiles`)
				log.info(`writing metas to db`)


				for(let {twitter, accounts} of batch){
					let profile = data.find(entry => entry.username.toLowerCase() === twitter.toLowerCase())
					let meta = {
						followers: null,
						name: undefined,
						icon: undefined,
						description: undefined,
						domain: undefined
					}


					if(profile){
						meta.followers = profile.public_metrics.followers_count
						meta.name = profile.name
						meta.description = profile.description
						meta.icon = profile.profile_image_url
							? profile.profile_image_url.replace('_normal', '')
							: undefined

						if(profile.entities?.url?.urls){
							meta.domain = profile.entities.url.urls[0].expanded_url
								.replace(/^https?:\/\//, '')
								.replace(/\/$/, '')
						}

						if(profile.entities?.description?.urls){
							let offset = 0

							for(let {start, end, expanded_url} of profile.entities.description.urls){
								meta.description = meta.description.slice(0, start + offset) + expanded_url + meta.description.slice(end + offset)
								offset += expanded_url.length - (end - start)
							}
						}
					}

					accounts.forEach(account => repo.tokenMetas.insert({
						meta,
						account,
						source: 'twitter'
					}))
				}

				i++
			}

			log.info(`meta cycle complete`)
		}
	})
}