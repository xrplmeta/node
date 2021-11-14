import { keySort, mapMultiKey, nestDotNotated } from '../../../common/data.js'
import Decimal from '../../../common/decimal.js'
import { log } from '../../lib/logging.js'


export default class{
	constructor(ctx){
		this.ctx = ctx
		this.data = []
		this.log = log.for('server.trustlines', 'green')
	}

	async init(){
		await this.buildAll(progress => 
			this.log.replace(`building list (${Math.round(progress * 100)}%)`)
		)

		this.log(`built list           `)

		this.ctx.repo.updates.subscribe(this.handleUpdates.bind(this))
	}

	async get(){
		return this.data.map(({data}) => data)
	}

	async handleUpdates(updates){
		for(let update of updates){
			if(!['trustlines', 'metas', 'stats'].includes(update.context))
				continue

			let entry

			switch(update.type){
				case 'issuer':
					entry = this.data.find(({ids}) => ids.issuer === update.subject)
					break

				case 'trustline':
					entry = this.data.find(({ids}) => ids.trustline === update.subject)
					break
			}

			if(!entry)
				continue

			await this.build(entry.data)
		}
	}

	async buildAll(progress){
		let trustlines = await this.ctx.repo.trustlines.get()
		let i = 0

		for(let trustline of trustlines){
			await this.build(trustline)

			if(progress)
				progress(i++ / trustlines.length)
		}
	}

	async build(trustline){
		let ctx = this.ctx
		let { currency, issuer } = trustline
		let issuerId

		if(typeof issuer === 'number'){
			issuerId = issuer
			issuer = (await ctx.repo.issuers.getOne({id: issuer})).address
		}else{
			issuerId = (await ctx.repo.issuers.getOne({address: issuer})).id
		}
		
		let currentStats = await ctx.repo.stats.getRecent(trustline)
		let currencyMetas = await ctx.repo.metas.get('trustline', trustline.id)
		let issuerMetas = await ctx.repo.metas.get('issuer', issuerId)
		let yesterdayStats
		let trustlinesCount
		let meta = {}
		let stats = {}


		meta.currency = this.sortMetas(
			nestDotNotated(mapMultiKey(currencyMetas, 'key', true)),
			ctx.config.api.defaultSourcePriority
		)

		meta.issuer = this.sortMetas(
			nestDotNotated(mapMultiKey(issuerMetas, 'key', true)),
			ctx.config.api.defaultSourcePriority
		)

		if(currentStats){
			stats.trustlines = currentStats.accounts
			stats.supply = currentStats.supply
			stats.liquidity = Decimal.sum(currentStats.buy, currentStats.sell).toString()

			yesterdayStats = await ctx.repo.stats.getRecent(trustline, currentStats.date - 60*60*24)

			if(yesterdayStats){
				stats.trustlines_change = Math.round((currentStats.accounts / yesterdayStats.accounts - 1) * 10000) / 100
			}
		}

		let data = {
			currency, 
			issuer,
			meta,
			stats,
		}

		let existing = this.data.find(({data}) => 
			data.currency === currency 
			&& data.issuer === issuer
		)

		if(existing){
			Object.assign(existing.data, data)
		}else{
			this.data.push({
				data,
				ids: {
					trustline: trustline.id,
					issuer: issuerId
				}
			})
		}
	}

	sortMetas(metas, sourcePriority){
		for(let [key, values] of Object.entries(metas)){
			if(Array.isArray(values)){
				keySort(values, meta => {
					let priority = sourcePriority.indexOf(meta.source)

					return priority >= 0 ? priority : 9999
				})
			}else if(typeof values === 'object'){
				Object.values(values).forEach(metas => this.sortMetas(metas, sourcePriority))
			}
		}

		return metas
	}
}