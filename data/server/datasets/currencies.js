import { keySort, mapMultiKey, nestDotNotated } from '../../../common/data.js'
import Decimal from '../../../common/decimal.js'

export default class{
	constructor(ctx){
		this.ctx = ctx
		this.data = []
	}

	async init(){
		await this.updateAll()
	}

	get(){
		return this.data.map(({data}) => data)
	}

	async handleUpdates(updates){
		if(updates.Stats){
			await this.updateAll()
			return
		}

		if(updates.Trustlines){
			for(let trustline of updates.Trustlines){
				await this.update(trustline)
			}
		}

		if(updates.Metas){
			for(let meta of updates.Metas){
				let entry

				switch(meta.type){
					case 'issuer':
						entry = this.data.find(({ids}) => ids.issuer === meta.subject)
						break

					case 'currency':
						entry = this.data.find(({ids}) => ids.trustline === meta.subject)
						break
				}

				if(!entry)
					continue

				await this.update(entry.data)
			}
		}
	}

	async updateAll(){
		let trustlines = await this.ctx.repo.getTrustlines()

		for(let trustline of trustlines){
			await this.update(trustline)
		}
	}

	async update(trustline){
		let ctx = this.ctx
		let { currency, issuer } = trustline
		let issuerId

		if(typeof issuer === 'number'){
			issuerId = issuer
			issuer = (await ctx.repo.getIssuer({address: issuer})).address
		}else{
			issuerId = (await ctx.repo.getIssuer({address: issuer})).id
		}
		
		let currentStats = await ctx.repo.getRecentStats(trustline)
		let currencyMetas = await ctx.repo.getMetas('currency', trustline.id)
		let issuerMetas = await ctx.repo.getMetas('issuer', issuerId)
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
			stats.liquidity = Decimal.sum(currentStats.buy, currentStats.sell)

			yesterdayStats = await ctx.repo.getRecentStats(trustline, currentStats.date - 60*60*24)

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