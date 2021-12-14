import { Logger } from '@xrplmeta/common/lib/log.js'
import { unixNow } from '@xrplmeta/common/lib/time.js'
import { keySort, mapMultiKey, nestDotNotated } from '@xrplmeta/common/lib/data.js'
import Decimal from '@xrplmeta/common/lib/decimal.js'


const log = new Logger({name: 'sync'})


export function allocate(heads){
	log.time(`sync.trustlines`, `building trustlines cache`)

	let trustlines = this.repo.trustlines.all()
	let progress = 0
	
	for(let i=0; i<trustlines.length; i++){
		compose.call(this, trustlines[i])

		let newProgress = Math.floor((i / trustlines.length) * 100)

		if(newProgress !== progress){
			progress = newProgress
			log.info(`processed`, i, `of`, trustlines.length, `trustlines (${progress}%)`)
		}
	}

	log.time(`sync.trustlines`, `built trustlines cache in %`)
}

function compose(trustline){
	let { id, currency, issuer: issuerId } = trustline
	let issuer = this.repo.accounts.get({id: issuerId})	
	let currencyMetas = this.repo.metas.all({trustline})
	let issuerMetas = this.repo.metas.all({account: issuerId})
	let meta = {
		currency: sortMetas(
			nestDotNotated(mapMultiKey(currencyMetas, 'key', true)),
			this.config.api.sourcePriorities
		),
		issuer: sortMetas(
			nestDotNotated(mapMultiKey(issuerMetas, 'key', true)),
			this.config.api.sourcePriorities
		)
	}


	let currentStats = this.repo.stats.get(trustline)
	let yesterdayStats
	let now = unixNow()
	let candles = this.cache.candles.all(
		{base: id, quote: null, interval: 86400},
		now - 60*60*24*7
	)
	let stats = {
		marketcap: new Decimal(0),
		volume: new Decimal(0),
		trustlines: 0
	}

	if(currentStats){
		stats.trustlines = currentStats.accounts
		stats.supply = currentStats.supply
		stats.liquidity = {ask: currentStats.ask, bid: currentStats.bid}

		yesterdayStats = this.repo.stats.get(trustline, currentStats.date - 60*60*24)

		if(yesterdayStats){
			stats.trustlines_change = Math.round((currentStats.accounts / yesterdayStats.accounts - 1) * 10000) / 100
		}
	}

	if(candles.length > 0){
		let newestCandle = candles[candles.length - 1]
		let lastWeeksCandle = candles[0]

		stats.price = newestCandle.c
		stats.price_change = Math.round((newestCandle.c / newestCandle.o - 1) * 1000)/10
		stats.marketcap = Decimal.mul(stats.supply || 0, newestCandle.c)
		stats.volume = Decimal.sum(...candles
			.slice(candles.indexOf(lastWeeksCandle))
			.map(candle => candle.v)
		)
	}

	let full = {stats, meta}
	let minimal = {
		stats: {
			...stats,
			liquidity: undefined
		}, 
		meta: {
			currency: collapseMetas(
				meta.currency, 
				this.config.api.sourcePriorities
			),
			issuer: collapseMetas(
				{
					...meta.issuer,
					emailHash: undefined,
					socials: undefined,
					description: undefined
				}, 
				this.config.api.sourcePriorities
			)
		}
	}

	this.cache.trustlines.insert({
		id,
		currency, 
		issuer: issuer.address,
		minimal,
		full
	})
}


function sortMetas(metas, priorities){
	let sorted = {}

	for(let [key, values] of Object.entries(metas)){
		if(Array.isArray(values)){
			sorted[key] = keySort(values, meta => {
				let index = priorities.indexOf(meta.source)

				return index >= 0 ? index : 9999
			})
		}else if(typeof values === 'object'){
			sorted[key] = sortMetas(values, priorities)
		}
	}

	return sorted
}


function collapseMetas(metas, sourcePriority){
	let collapsed = {}

	for(let [key, values] of Object.entries(metas)){
		if(!values)
			continue

		if(Array.isArray(values)){
			let meta = values[0]

			if(meta.value)
				collapsed[key] = meta.value
		}else{
			collapsed[key] = collapseMetas(values, sourcePriority)
		}
	}

	return collapsed
}