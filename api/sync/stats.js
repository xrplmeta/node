import Decimal from 'decimal.js'
import { leftProximityZip } from '@xrplmeta/utils'
import log from '@xrplmeta/log'

log.config({
	name: 'sync:stats',
	color: 'cyan'
})

const mcapCandle = 60*60*4



export function allocate(heads){
	log.time(`sync.stats`, `building stats cache`)

	let tokens = this.repo.tokens.all()
	let progress = 0
	
	for(let i=0; i<tokens.length; i++){
		let token = tokens[i]
		let stats = this.repo.stats.all(token)
			.map(({token, count, ...stat}) => ({
				...stat,
				tokens: count
			}))

		if(stats.length === 0)
			continue

		let candles = this.cache.candles.all(
			{base: token.id, quote: null, interval: mcapCandle},
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

		this.cache.stats.set(token, combined)


		let newProgress = Math.floor((i / tokens.length) * 100)

		if(newProgress !== progress){
			progress = newProgress
			log.info(`processed`, i, `of`, tokens.length, `stats (${progress}%)`)
		}
	}

	log.time(`sync.stats`, `built stats cache in %`)
}

export function register({ affected }){
	let relevant = affected.filter(({contexts}) => 
		contexts.some(context => ['stat'].includes(context)))

	for(let { type, id } of relevant){
		if(type === 'token'){
			let ids = this.repo.all(`SELECT id FROM Stats WHERE token = ?`, id)
			let missing = this.cache.stats.vacuum({id}, ids)

			for(let msid of missing){
				let {token, count, ...stat} = this.repo.stats.get({id: msid})
				let candle = this.cache.candles.all(
					{base: token.id, quote: null, interval: mcapCandle},
					Math.floor(stat.date / mcapCandle) * mcapCandle,
					Math.ceil(stat.date / mcapCandle) * mcapCandle
				)[0]

				this.cache.stats.insert({id}, {
					...stat,
					tokens: count,
					marketcap: candle
						? Decimal.mul(stat.supply, candle.c).toString()
						: '0',
				})
			}

			log.debug(`updated stats (TL${id})`)
		}
	}
}