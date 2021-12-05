import { keySort, mapMultiKey, nestDotNotated } from '@xrplmeta/common/lib/data.js'
import Decimal from '@xrplmeta/common/lib/decimal.js'
import { log } from '@xrplmeta/common/lib/log.js'


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
		let trustlines = this.ctx.repo.trustlines.all()
		let i = 0

		for(let trustline of trustlines){
			await this.build(trustline)

			if(progress)
				await progress(i++ / trustlines.length)
		}
	}

	async build(trustline){
		let ctx = this.ctx
		let { id, currency, issuer: issuerId } = trustline
		let issuer = ctx.repo.accounts.get({id: issuerId})

		if(!issuer)
			return

		
		let currencyMetas = ctx.repo.metas.all({trustline})
		let issuerMetas = ctx.repo.metas.all({account: issuerId})
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
			id,
			currency, 
			issuer: issuer.address,
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
		let currentStats = this.ctx.repo.stats.get(trustline)
		let yesterdayStats
		let candles = await this.ctx.datasets.exchanges.get(trustline, {currency: 'XRP'}, '1d')
		let enriched = {
			...trustline,
			stats: {}
		}

		if(currentStats){
			enriched.stats.trustlines = currentStats.accounts
			enriched.stats.supply = currentStats.supply
			enriched.stats.liquidity = {ask: currentStats.ask, bid: currentStats.bid}

			yesterdayStats = this.ctx.repo.stats.get(trustline, currentStats.date - 60*60*24)

			if(yesterdayStats){
				enriched.stats.trustlines_change = Math.round((currentStats.accounts / yesterdayStats.accounts - 1) * 10000) / 100
			}
		}

		if(candles.length > 0){
			let newestCandle = candles[candles.length - 1]
			let lastWeeksCandle = candles.find(candle => candle.t >= newestCandle.t - 60*60*24*7)

			enriched.stats.price = newestCandle.c
			enriched.stats.price_change = Math.round((newestCandle.c / newestCandle.o - 1) * 1000)/10
			enriched.stats.marketcap = Decimal.mul(enriched.stats.supply || 0, newestCandle.c)
			enriched.stats.volume = Decimal.sum(...candles
				.slice(candles.indexOf(lastWeeksCandle))
				.map(candle => candle.v)
			)
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