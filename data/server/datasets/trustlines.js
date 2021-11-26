import { keySort, mapMultiKey, nestDotNotated } from '../../../common/data.js'
import Decimal from '../../../common/decimal.js'
import { log } from '../../lib/log.js'


export default class{
	constructor(ctx){
		this.ctx = ctx
		this.data = []
	}

	async init(progress){
		await this.buildAll(p => progress(p))

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

			await this.build({
				currency: entry.data.currency,
				id: entry.ids.trustline,
				issuer: entry.ids.issuer,
			})
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
		
		let currencyMetas = await ctx.repo.metas.get('trustline', trustline.id)
		let issuerMetas = await ctx.repo.metas.get('issuer', issuerId)
		let meta = {
			currency: this.sortMetas(
				nestDotNotated(mapMultiKey(currencyMetas, 'key', true)),
				ctx.config.api.defaultSourcePriority
			),
			issuer: this.sortMetas(
				nestDotNotated(mapMultiKey(issuerMetas, 'key', true)),
				ctx.config.api.defaultSourcePriority
			)
		}

		let data = await this.enrich({
			currency, 
			issuer,
			meta
		})

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

	async enrich(trustline){
		let currentStats = await this.ctx.repo.stats.getRecent(trustline)
		let yesterdayStats
		let candles = await this.ctx.datasets.exchanges.get(trustline, {currency: 'XRP'}, '1d')
		let enriched = {
			...trustline,
			stats: []
		}

		if(currentStats){
			stats.trustlines = currentStats.accounts
			stats.supply = currentStats.supply
			stats.liquidity = Decimal.sum(currentStats.buy, currentStats.sell).toString()

			yesterdayStats = await this.ctx.repo.stats.getRecent(trustline, currentStats.date - 60*60*24)

			if(yesterdayStats){
				stats.trustlines_change = Math.round((currentStats.accounts / yesterdayStats.accounts - 1) * 10000) / 100
			}
		}

		if(candles.length > 0){
			let newestCandle = candles[candles.length - 1]
			let lastWeeksCandle = candles.find(candle => candle.t >= newestCandle.t - 60*60*24*7)

			enriched.stats = {
				...enriched.stats,
				price: newestCandle.c,
				price_change: Math.round((newestCandle.c / newestCandle.o - 1) * 1000)/10,
				marketcap: Decimal.mul(enriched.stats.supply || 0, newestCandle.c),
				volume: Decimal.sum(...candles
					.slice(candles.indexOf(lastWeeksCandle))
					.map(candle => candle.v)
				)
			}
		}

		return enriched
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