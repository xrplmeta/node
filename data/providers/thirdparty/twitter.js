import { pretty } from '../../lib/logging.js'
import { batched } from '../../../common/data.js'
import { RestProvider } from '../base.js'


export default class extends RestProvider{
	constructor({repo, nodes, config}){
		super('twitter', {
			base: 'https://api.twitter.com/2',
			headers: {
				authorization: `Bearer ${config.twitter.bearerToken}`
			},
			ratelimit: config.twitter.maxRequestsPerMinute 
				? {
					tokensPerInterval: config.twitter.maxRequestsPerMinute, 
					interval: 'minute'
				}
				: null
		})

		this.repo = repo
		this.nodes = nodes
		this.config = config.twitter
	}
 

	run(){
		this.loopOperation(
			'twitter',
			null,
			this.config.refreshInterval,
			this.cycle.bind(this)
		)
	}


	async cycle(){
		this.log(`collecting targets`)

		let targets = {}

		for(let issuer of await this.repo.issuers.get()){
			let twitter = await this.repo.metas.getOne('issuer', issuer.id, 'socials.twitter')

			if(!twitter)
				continue

			if(!targets[twitter])
				targets[twitter] = []

			targets[twitter].push(issuer.id)
		}

		let targetTodo = Object.entries(targets)
			.map(([twitter, issuers]) => ({twitter, issuers}))

		let targetBatches = batched(targetTodo, 100)
		let i = 0

		this.log(`got ${pretty(targetTodo.length)} twitter pages to scrape (${targetBatches.length} batches)`)

		for(let batch of targetBatches){
			this.log(`scraping batch ${i} of ${targetBatches.length}`)

			let { data, error } = await this.api.get(`users/by`, {
				usernames: batch
					.map(({twitter}) => twitter)
					.join(','),
				'user.fields': 'name,profile_image_url,description,entities'
			})

			this.log(`got ${data.length} profiles`)
			this.log(`writing metas to db`)


			for(let {twitter, issuers} of batch){
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

				await this.repo.metas.set(issuers.map(issuer => ({
					meta,
					type: 'issuer',
					subject: issuer,
					source: 'twitter.com'
				})))
			}

			i++
		}

		this.log(`cycle complete`)
	}
}