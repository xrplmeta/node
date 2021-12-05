import { leftProximityZip } from '@xrplmeta/common/lib/data.js'
import { createURI as createPairURI } from '@xrplmeta/common/lib/pair.js'
import Decimal from '@xrplmeta/common/lib/decimal.js'



export default class{
	constructor(ctx){
		this.ctx = ctx
		this.data = {}
	}

	async init(progress){
		let trustlines = await this.ctx.repo.trustlines.all()
		let i = 0

		for(let trustline of trustlines){
			await this.build(trustline)
			await progress(i++ / trustlines.length)
		}

		this.ctx.repo.updates.subscribe(this.handleUpdates.bind(this))
	}

	async get(trustline){
		let key = this.deriveKey(trustline)

		if(!this.data[key])
			await this.build(trustline)

		return this.data[key].historicals
	}

	async handleUpdates(updates){
		for(let update of updates){
			if(update.context !== 'stats' || update.context !== 'trustline')
				continue

			let entry = Object.values(this.data).find(({trustline}) => trustline.id === update.subject)

			if(entry){
				await this.build(entry.trustline)
			}
		}
	}


	async build(trustline){
		let ctx = this.ctx
		let stats = ctx.repo.stats.all(trustline)
		let exchanges = await ctx.datasets.exchanges.get(
			trustline,
			{currency: 'XRP'},
			'4h'
		)
		let aligned = leftProximityZip(
			{
				array: stats,
				key: stat => Math.floor(stat.date / (60*60*4)),
			},
			{
				array: exchanges,
				key: exchange => Math.floor(exchange.t / (60*60*4)),
			}
		)

		let historicals = aligned.map(([stat, exchange]) => ({
			date: stat.date,
			trustlines: stat.count,
			supply: stat.supply,
			liquidity: {buy: stat.buy, sell: stat.sell},
			marketcap: exchange ? Decimal.mul(stat.supply, exchange.c) : '0'
		}))

		this.data[this.deriveKey(trustline)] = {
			historicals,
			trustline: ctx.repo.trustlines.get(trustline)
		}
	}

	deriveKey(trustline){
		return `${trustline.currency}:${trustline.issuer}`
	}
}
