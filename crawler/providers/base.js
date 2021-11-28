import fetch from 'node-fetch'
import Rest from '../lib/rest.js'
import { wait, unixNow } from '../../common/lib/time.js'



export class BaseProvider{
	constructor({repo, config}){
		this.repo = repo
		
	}

	async loopOperation(type, entity, interval, execute){
		while(true){
			await wait(10)

			if(entity){
				let operation = await this.repo.operations.getNext(type, entity)

				if(!operation || (operation.result === 'success' && operation.start + interval > unixNow())){
					await wait(1000)
					continue
				}

				await this.repo.operations.record(
					type, 
					`${entity}:${operation.entity}`, 
					execute(operation.entity)
				)
			}else{
				let recent = await this.repo.operations.getMostRecent(type)

				if(recent && recent.result === 'success' && recent.start + interval > unixNow()){
					await wait(1000)
					continue
				}

				await this.repo.operations.record(type, null, execute())
			}

			
		}
	}

}


export class RestProvider extends BaseProvider{
	constructor(cfg){
		super()
		this.api = new Rest({fetch, ...cfg})
	}
}


export class SparseLedgerProvider extends BaseProvider{
	constructor(cfg){
		super()
		
	}
}

export class DenseLedgerProvider extends BaseProvider{
	constructor(cfg){
		super()
		
	}
}
