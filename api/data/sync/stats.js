import Decimal from '@xrplmeta/common/lib/decimal.js'
import { leftProximityZip } from '@xrplmeta/common/lib/data.js'
import { Logger } from '@xrplmeta/common/lib/log.js'

const log = new Logger({name: 'sync'})
const mcapCandle = 60*60*4



export function allocate(heads){
	log.time(`sync.stats`, `building stats cache`)

	let trustlines = this.repo.trustlines.all()
	let progress = 0
	
	for(let i=0; i<trustlines.length; i++){
		let trustline = trustlines[i]
		let stats = this.repo.stats.all(trustline)
			.map(({trustline, count, ...stat}) => ({
				...stat,
				trustlines: count
			}))

		if(stats.length === 0)
			continue

		let candles = this.cache.candles.all(
			{base: trustline.id, quote: null, interval: mcapCandle},
			Math.floor(stats[0].date / mcapCandle) * mcapCandle,
			Math.ceil(stats[stats.length-1].date / mcapCandle) * mcapCandle
		)

		let aligned = leftProximityZip(
			{
				array: stats,
				key: stat => Math.floor(stat.date / (60*60*4)),
			},
			{
				array: candles,
				key: candle => Math.floor(candle.t / (60*60*4)),
			}
		)

		let combined = aligned.map(([stat, candle]) => ({
			...stat,
			marketcap: candle
				? Decimal.mul(stat.supply, candle.c).toString() 
				: '0'
		}))

		this.cache.stats.set(trustline, combined)


		let newProgress = Math.floor((i / trustlines.length) * 100)

		if(newProgress !== progress){
			progress = newProgress
			log.info(`processed`, i, `of`, trustlines.length, `stats (${progress}%)`)
		}
	}

	log.time(`sync.stats`, `built stats cache in %`)
}

export function register(updates){
	let relevant = affected.filter(({contexts}) => 
		contexts.some(context => ['stat'].includes(context)))

	for(let { type, id } of relevant){
		if(type === 'trustline'){
			let ids = this.repo.all(`SELECT id FROM Stats WHERE trustline = ?`, id)
			let missing = this.cache.stats.vacuum({id}, ids)

			for(let msid of missing){
				let {trustline, count, ...stat} = this.repo.stats.get({id: msid})
				let candle = this.cache.candles.all(
					{base: trustline.id, quote: null, interval: mcapCandle},
					Math.floor(stat.date / mcapCandle) * mcapCandle,
					Math.ceil(stat.date / mcapCandle) * mcapCandle
				)[0]

				this.cache.stats.insert({id}, {
					...stat,
					trustlines: count,
					marketcap: candle
						? Decimal.mul(stat.supply, candle.c).toString()
						: '0',
				})
			}

			log.debug(`updated stats (TL${id})`)
		}
	}
}