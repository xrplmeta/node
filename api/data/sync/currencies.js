import { Logger } from '@xrplmeta/common/lib/log.js'
import { unixNow } from '@xrplmeta/common/lib/time.js'
import { keySort, mapMultiKey, nestDotNotated } from '@xrplmeta/common/lib/data.js'
import Decimal from '@xrplmeta/common/lib/decimal.js'


const log = new Logger({name: 'sync'})


export function allocate(heads){
	log.time(`sync.currencies`, `building currencies cache`)

	let trustlines = this.repo.trustlines.all()
	let currencies = trustlines
		.map(trustline => trustline.currency)
		.filter((currency, index, list) => list.indexOf(currency) === index)
	let progress = 0
	
	for(let i=0; i<currencies.length; i++){
		compose.call(this, currencies[i])

		let newProgress = Math.floor((i / currencies.length) * 100)

		if(newProgress !== progress){
			progress = newProgress
			log.info(`processed`, i, `of`, currencies.length, `currencies (${progress}%)`)
		}
	}

	log.time(`sync.currencies`, `built trustlines cache in %`)
}

function compose(currency){
	let trustlines = this.cache.trustlines.all({currency}, true)
	let marketcap = new Decimal(0)
	let volume = new Decimal(0)

	for(let trustline of trustlines){
		volume = volume.plus(trustline.stats.volume || 0)
		marketcap = marketcap.plus(trustline.stats.marketcap || 0)
	}

	this.cache.currencies.insert({currency, marketcap, volume})
}

export function register({ affected }){
	let relevant = affected.filter(({contexts}) => 
		contexts.some(context => ['exchange', 'stat'].includes(context)))

	for(let { type, id } of relevant){
		if(type === 'trustline'){
			compose.call(this, this.repo.trustlines.get({id}).currency)
			log.debug(`updated currency (TL${id})`)
		}
	}
}