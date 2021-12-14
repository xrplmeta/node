import { Logger } from '@xrplmeta/common/lib/log.js'

const log = new Logger({name: 'sync'})


export function allocate(heads){
	log.time(`sync.stats`, `building stats cache`)

	let trustlines = this.repo.trustlines.all()
	let progress = 0
	
	for(let i=0; i<trustlines.length; i++){
		let trustline = trustlines[i]
		
		compose.call(this, trustline)

		let newProgress = Math.floor((i / trustlines.length) * 100)

		if(newProgress !== progress){
			progress = newProgress
			log.info(`processed`, i, `of`, trustlines.length, `stats (${progress}%)`)
		}
	}

	log.time(`sync.stats`, `built stats cache in %`)
}

function compose(trustline){
	let stats = this.repo.stats.all(trustline)

	this.cache.stats.set(trustline, stats)
}