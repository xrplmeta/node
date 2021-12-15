import { Logger } from '@xrplmeta/common/lib/log.js'

const log = new Logger({name: 'sync'})


export function allocate(heads){
	log.time(`sync.stats`, `building stats cache`)

	let trustlines = this.repo.trustlines.all()
	let progress = 0
	
	for(let i=0; i<trustlines.length; i++){
		let trustline = trustlines[i]
		let stats = this.repo.stats.all(trustline)
			.map(({trustline, ...stat}) => stat)

		this.cache.stats.set(trustline, stats)

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

			this.cache.stats.vacuum(ids)

			compose.call(this, this.repo.trustlines.get({id}))
			log.debug(`updated stats (TL${id})`)
		}
	}
}

function compose(trustline){
	let stats = this.repo.stats.all(trustline)
		.map(({trustline, ...stat}) => stat)

	this.cache.stats.set(trustline, stats)
}