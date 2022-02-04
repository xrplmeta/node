import Rest from '../../lib/rest.js'
import log from '@xrplmeta/log'
import { batched } from '@xrplmeta/utils'


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
			task: 'twitter.meta',
			interval: config.twitter.refreshIntervalMeta
		},
		async t => {
			log.info(`collecting targets`)

			let targets = {}

			for(let { id } of repo.accounts.all()){
				let meta = repo.metas.get({account: id, key: 'twitter_user'})
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
				log.info(`collecting batch ${i} of ${targetBatches.length}`)

				let { data, error } = await api.get(`users/by`, {
					usernames: batch
						.map(({twitter}) => twitter)
						.join(','),
					'user.fields': 'name,profile_image_url,description,entities,public_metrics'
				})

				log.info(`got`, data.length, `profiles`)
				log.info(`writing metas to db`)


				for(let {twitter, accounts} of batch){
					let profile = data.find(entry => entry.username.toLowerCase() === twitter.toLowerCase())
					let meta = {
						twitter_id: null,
						twitter_followers: null,
						name: null,
						icon: null,
						description: null,
						domain: null
					}

					if(profile){
						meta.twitter_id = profile.id
						meta.twitter_followers = profile.public_metrics.followers_count
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

					accounts.forEach(account => repo.metas.insert({
						meta,
						account,
						source: 'twitter'
					}))
				}

				i++
			}

			log.info(`meta cycle complete`)
		}
	)

	/*loopTimeTask(
		{
			task: 'twitter.posts',
			interval: config.twitter.refreshIntervalPosts,
			subject: 'A'
		},
		async (t, account) => {
			let metaId = repo.metas.get({account, key: 'twitter_id'})
			let metaUser = repo.metas.get({account, key: 'twitter_user'})
			
			if(metaId && metaId.value){
				let id = metaId.value
				let { data } = await api.get(`users/${id}/tweets`,{
					'exclude': 'retweets,replies',
					'tweet.fields': 'created_at,entities,public_metrics',
					'user.fields': 'name,profile_image_url,username,verified'
				})


				if(data && data.length > 0){
					repo.updates.insert({
						platform: 'twitter',
						account,
						updates: data
							.map(tweet => ({
								uid: tweet.id,
								data: tweet,
								date: Math.floor(Date.parse(tweet.created_at) / 1000)
							}))
					})

					log.info(`stored ${data.length} tweets for ${metaUser.value}`)
				}
			}
		}
	)*/
}