import { wait } from '../../common/time.js'

export async function subscribe(repo, callback){
	let heads = await repo.getTableHeads()

	while(true){
		let nextHeads = await repo.getTableHeads()
		let updates = {}

		for(let [k, i] of Object.entries(heads)){
			if(nextHeads[k] !== i){
				updates[k] = await repo.getTableEntriesAfter(k, i)
			}
		}

		if(Object.keys(updates).length === 0){
			await wait(1000)
			continue
		}


		heads = nextHeads
		callback(updates)
	}
}