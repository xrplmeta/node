import { wait } from '../../lib/time.js'

const subscriptions = []


export async function subscribe(callback){
	if(subscriptions.length === 0)
		loop(this)

	subscriptions.push(callback)
}



async function loop(repo){
	let heads = repo.heads.all()

	while(true){
		let nextHeads = repo.heads.all()
		let updates = []

		for(let [k, i] of Object.entries(heads)){
			if(nextHeads[k] !== i){
				let newEntries = await getTableEntriesAfter(repo, k, i)
				let newSubjects = []

				switch(k){
					case 'Trustlines':
						updates.push(...newEntries.map(({id}) => ({
							context: 'trustlines',
							type: 'trustline',
							subject: id
						})))
						break

					case 'Metas':
						updates.push(...newEntries.map(({type, id}) => ({
							context: 'metas',
							type,
							subject: id,
						})))
						break

					case 'Stats':
						updates.push(...newEntries.map(({trustline}) => ({
							context: 'stats',
							type: 'trustline',
							subject: trustline,
						})))
						break

					case 'Exchanges':
						newEntries.forEach(({base, quote}) => {
							if(base)
								updates.push({
									context: 'exchanges',
									type: 'trustline',
									subject: base,
								})

							if(quote)
								updates.push({
									context: 'exchanges',
									type: 'trustline',
									subject: quote,
								})
						})
						break
				}
			}
		}

		if(updates.length === 0){
			await wait(1000)
			continue
		}

		updates = updates.filter((update, i) => {
			let index = updates.findIndex(u => true
				&& u.context === update.context
				&& u.type === update.type
				&& u.subject === update.subject)

			return index === i
		})

		heads = nextHeads
	
		for(let callback of subscriptions){
			try{
				await callback(updates)
			}catch{
				continue
			}
		}
	}
}


function getTableEntriesAfter(repo, table, id){
	return repo.all(
		`SELECT *
		FROM ${table}
		WHERE id > ?`,
		id
	)
}