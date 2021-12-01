import Rest from '../../lib/rest.js'
import { batched } from '@xrplmeta/common/lib/data.js'
import { log } from '@xrplmeta/common/lib/log.js'
import { decodeAddress } from '@xrplmeta/common/lib/xrpl.js'


export default ({repo, config, loopTimeTask}) => {
	let api = new Rest({
		base: 'https://api.twitter.com/2',
		headers: {
			authorization: `Bearer ${config.twitter.bearerToken}`
		},
		ratelimit: config.twitter.maxRequestsPerMinute 
	})

	loopTimeTask(
		{
			task: 'twitter',
			interval: config.twitter.refreshInterval
		},
		async t => {
			log.info(`collecting targets`)

			let targets = {}

			for(let { id } of await repo.accounts.all()){
				let meta = await repo.metas.get({account: id, key: 'socials.twitter'})
				let twitter = meta?.value

				if(!twitter)
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
				log.info(`scraping batch ${i} of ${targetBatches.length}`)

				let { data, error } = await api.get(`users/by`, {
					usernames: batch
						.map(({twitter}) => twitter)
						.join(','),
					'user.fields': 'name,profile_image_url,description,entities'
				})

				log.info(`got`, data.length, `profiles`)
				log.info(`writing metas to db`)


				for(let {twitter, accounts} of batch){
					let profile = data.find(entry => entry.username.toLowerCase() === twitter.toLowerCase())
					let meta = {
						name: null,
						icon: null,
						description: null,
						domain: null
					}

					if(profile){
						meta.name = profile.name || null
						meta.description = profile.description || null
						meta.icon = profile.profile_image_url
							? profile.profile_image_url.replace('_normal', '')
							: null

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

					await repo.metas.insert(accounts.map(account => ({
						meta,
						account,
						source: 'twitter.com'
					})))
				}

				i++
			}

			log.info(`cycle complete`)
		}
	)
}