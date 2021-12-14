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
		let exchangesB = this.repo.exchanges.all(trustline, null)
			.filter(exchange => exchange.id <= heads.Exchanges)
		let exchangesQ = this.repo.exchanges.invert(exchangesB)

		if(exchangesB.length > 0){
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

			processed += exchangesB.length
		}

		let e = processed / count
		let t = i / trustlines.length
		let newProgress = Math.floor((e * 0.75 + t * 0.25) * 100)

		if(newProgress !== progress){
			progress = newProgress
			log.info(`processed`, processed, `of`, count, `exchanges from`, i, `trustlines (${progress}%)`)
		}
	}

	log.time(`sync.candles`, `built exchanges cache in %`)
}