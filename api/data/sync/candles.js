import { Logger } from '@xrplmeta/common/lib/log.js'

const log = new Logger({name: 'sync'})
const intervals = [
	5 * 60,
	15 * 60,
	60 * 60,
	4 * 60 * 60,
	24 * 60 * 60
]


export function allocate(heads){
	log.time(`sync.candles`, `building exchanges cache`)

	let pairs = this.repo.exchanges.pairs()
	let count = this.repo.exchanges.count()
	let processed = 0
	let progress = 0

	let uniquePairs = pairs.filter(({base, quote}, i) => 
		i > pairs.findIndex(pair => true
			&& pair.base === quote 
			&& pair.quote === base
		)
	)


	for(let {base, quote} of uniquePairs){
		let exchanges = [
			...this.repo.exchanges.iter({base: base, quote: quote}),
			...this.repo.exchanges.iter({base: quote, quote: base})
		]

		exchanges.sort((a, b) => a.date - b.date)

		if(exchanges.length > 0){
			this.cache.tx(() => {
				for(let interval of intervals){
					this.cache.candles.allocate(
						{base: base, quote: quote, interval},
						exchanges.map(exchange => this.repo.exchanges.align(
							exchange, 
							base, 
							quote
						))
					)

					this.cache.candles.allocate(
						{base: quote, quote: base, interval},
						exchanges.map(exchange => this.repo.exchanges.align(
							exchange, 
							quote, 
							base
						))
					)
				}
			})

			processed += exchanges.length
		}

		let newProgress = Math.floor((processed / count) * 100)

		if(newProgress !== progress){
			progress = newProgress
			log.info(`processed`, processed, `of`, count, `exchanges (${progress}%)`)
		}
	}
	
	log.time(`sync.candles`, `built exchanges cache in %`)
}


export function register({ ranges }){
	if(!ranges.exchanges)
		return

	let newExchanges = this.repo.exchanges.iter({
		from: ranges.exchanges[0],
		to: ranges.exchanges[1]
	})

	for(let exchange of newExchanges){
		for(let interval of intervals){
			this.cache.candles.integrate(
				{base: exchange.base, quote: exchange.quote, interval},
				this.repo.exchanges.align(exchange, exchange.base, exchange.quote)
			)

			this.cache.candles.integrate(
				{base: exchange.quote, quote: exchange.base, interval},
				this.repo.exchanges.align(exchange, exchange.quote, exchange.base)
			)
		}
	}
}