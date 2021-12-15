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

	let trustlines = this.repo.trustlines.all()
	let count = this.repo.exchanges.count()
	let processed = 0
	let progress = 0
	
	for(let i=0; i<trustlines.length; i++){
		let trustline = trustlines[i]
		let exchanges = [
			...this.repo.exchanges.all({base: trustline, quote: null}),
			...this.repo.exchanges.all({base: null, quote: trustline})
		]

		exchanges.sort((a, b) => a.date - b.date)

		let exchangesB = exchanges.map(exchange => 
			this.repo.exchanges.align(exchange, trustline.id, null))
		let exchangesQ = exchanges.map(exchange => 
			this.repo.exchanges.align(exchange, null, trustline.id))

		if(exchanges.length > 0){
			this.cache.tx(() => {
				for(let interval of intervals){
					this.cache.candles.allocate(
						{base: trustline.id, quote: null, interval},
						exchangesB
					)

					this.cache.candles.allocate(
						{base: null, quote: trustline.id, interval},
						exchangesQ
					)
				}
			})

			processed += exchangesB.length
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

	let newExchanges = this.repo.exchanges.all({
		from: ranges.exchanges[0],
		to: ranges.exchanges[1]
	})

	for(let exchange of newExchanges){
		let tl = exchange.base || exchange.quote
		let exchangeB = this.repo.exchanges.align(exchange, tl, null)
		let exchangeQ = this.repo.exchanges.align(exchange, null, tl)

		for(let interval of intervals){
			this.cache.candles.integrate(
				{base: tl, quote: null, interval},
				exchangeB
			)

			this.cache.candles.integrate(
				{base: null, quote: tl, interval},
				exchangeQ
			)
		}
	}
}