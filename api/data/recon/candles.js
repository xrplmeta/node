import { log } from '@xrplmeta/common/lib/log.js'

const intervals = [
	5 * 60,
	15 * 60,
	60 * 60,
	4 * 60 * 60,
	24 * 60 * 60
]


export async function allocate({config, repo, cache}){
	log.info(`building exchanges cache`)

	let trustlines = repo.trustlines.all()
	let progress = 0
	
	for(let i=0; i<trustlines.length; i++){
		let trustline = trustlines[i]
		console.time(`get`)
		let exchangesB = repo.exchanges.all(trustline, null)
		let exchangesQ = repo.exchanges.all(null, trustline)
		console.timeEnd(`get`)

		for(let interval of intervals){
			cache.candles.allocate(
				{base: trustline.id, quote: null, interval},
				exchangesB
			)

			cache.candles.allocate(
				{base: null, quote: trustline.id, interval},
				exchangesQ
			)
		}

		console.log(i, trustlines.length)
	}
}