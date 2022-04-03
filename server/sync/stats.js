import Decimal from 'decimal.js'
import { leftProximityZip } from '../../lib/utils.js'
import log from '../../lib/log.js'



export function allocate(heads){
	log.time(`sync.stats`, `building stats cache`)

	let tokens = this.repo.tokens.all()
	let progress = 0
	
	for(let i=0; i<tokens.length; i++){
		let token = tokens[i].id
		let stats = this.repo.stats.all({token})
		let refTimeframe = Object.values(this.repo.config.server.snapshotTimeframes)[0]

		if(stats.length === 0)
			continue

		let candles = this.cache.candles.all(
			{
				base: token, 
				quote: null, 
				timeframe: refTimeframe
			}
		)

		let aligned = leftProximityZip(
			{
				array: stats,
				key: stat => Math.floor(stat.date / refTimeframe),
			},
			{
				array: candles,
				key: candle => Math.floor(candle.t / refTimeframe),
			}
		)

		

		let combined = aligned
			.map(([{ id, ...stat }, candle]) => ({
				...stat,
				marketcap: candle
					? Decimal.mul(stat.supply, candle.c).toString() 
					: '0'
			}))
			.map(({ token, ...stats }) => stats)

		for(let timeframe of Object.values(this.config.server.snapshotTimeframes)){
			this.cache.stats.allocate({token, timeframe}, combined)
		}

		let newProgress = Math.floor((i / tokens.length) * 100)

		if(newProgress !== progress){
			progress = newProgress
			log.info(`processed`, i, `of`, tokens.length, `stats (${progress}%)`)
		}
	}

	log.time(`sync.stats`, `built stats cache in %`)
}

export function register({ affected, ranges }){
	let timeframeCandles = Object.values(this.repo.config.server.snapshotTimeframes)[0]

	if(!ranges.stats)
		return

	let newStats = this.repo.stats.all({
		from: ranges.stats[0],
		to: ranges.stats[1]
	})

	for(let { token, ...stats } of newStats){
		let candle = this.cache.candles.all(
			{
				base: token,
				quote: null,
				timeframe: timeframeCandles
			},
			Math.floor(stats.date / timeframeCandles) * timeframeCandles,
			Math.ceil(stats.date / timeframeCandles) * timeframeCandles
		)[0]

		for(let timeframe of Object.values(this.config.server.snapshotTimeframes)){
			this.cache.stats.integrate(
				{
					token,
					timeframe
				},
				{
					...stats,
					marketcap: candle
						? Decimal.mul(stats.supply, candle.c).toString()
						: '0',
				}
			)
		}
	}
}