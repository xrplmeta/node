import mainlog from '@xrplmeta/log'


const log = mainlog.branch({
	name: 'sync:updates',
	color: 'cyan'
})



export function allocate(heads){
	log.time(`sync.updates`, `building updates cache`)

	let subjects = [
		...this.repo.accounts.all()
			.map(account => ({account: account.id})),
		...this.repo.tokens.all()
			.map(token => ({token: token.id}))
	]
	let progress = 0
	
	for(let i=0; i<subjects.length; i++){
		compose.call(this, subjects[i])

		let newProgress = Math.floor((i / subjects.length) * 100)

		if(newProgress !== progress){
			progress = newProgress
			log.info(`processed`, i, `of`, subjects.length, `subjects (${progress}%)`)
		}
	}

	log.time(`sync.updates`, `built updates cache in %`)
}

export function register({ affected }){
	let relevant = affected.filter(({contexts}) => 
		contexts.some(context => ['updates'].includes(context)))

	for(let { type, id } of relevant){
		compose({type, subject: id})
	}
}

function compose(subject){
	let updates = this.repo.updates.all(subject)

	if(updates.length > 0){


		this.cache.updates.set(subject, )
	}
}