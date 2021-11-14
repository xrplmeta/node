import { log } from '../../lib/logging.js'
import { leftProximityZip } from '../../../common/data.js'
import { createURI as createPairURI } from '../../../common/pair.js'
import Decimal from '../../../common/decimal.js'



export default class{
	constructor(ctx){
		this.ctx = ctx
		this.data = {}
		this.log = log.for('server.historicals', 'green')
	}

	async init(){
		let trustlines = await this.ctx.repo.trustlines.get()
		let i = 0

		for(let trustline of trustlines){
			await this.build(trustline)

			this.log.replace(`building cache (${Math.round((i++ / trustlines.length) * 100)}%)`)
		}

		this.log(`built cache           `)

		this.ctx.repo.updates.subscribe(this.handleUpdates.bind(this))
	}

	async get(trustline){
		let key = this.deriveKey(trustline)

		if(!this.data[key])
			await this.build(base, quote)

		return this.data[key].historicals
	}

	async handleUpdates(updates){
		for(let update of updates){
			
		}
	}


	async build(trustline){
		let ctx = this.ctx
		let stats = await ctx.repo.stats.get(trustline)
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
				key: exchange => Math.floor(exchange.date / (60*60*4)),
			}
		)

		let historicals = aligned.map(([stat, exchange]) => ({
			date: stat.date,
			trustlines: stat.accounts,
			supply: stat.supply,
			liquidity: {buy: stat.buy, sell: stat.sell},
			marketcap: exchange ? Decimal.mul(stat.supply, exchange.c) : '0'
		}))

		this.data[this.deriveKey(trustline)] = {
			historicals
		}
	}

	deriveKey(trustline){
		return `${trustline.currency}:${trustline.issuer}`
	}
}
