import fetch from 'node-fetch'
import Rest from '../../common/rest.js'
import { wait, unixNow } from '../../common/time.js'
import { log, pretty } from '../../common/logging.js'



export class BaseProvider{
	constructor(name){
		this.log = log.for(name, 'cyan')
	}

	async loopOperation(type, entity, interval, execute){
		while(true){
			await wait(10)

			if(entity){
				let operation = await this.repo.getNextEntityOperation(type, entity)

				if(!operation || (operation.result === 'success' && operation.start + interval > unixNow())){
					await wait(1000)
					continue
				}

				await this.repo.recordOperation(
					type, 
					`${entity}:${operation.entity}`, 
					execute(operation.entity)
				)
			}else{
				let recent = await this.repo.getMostRecentOperation(type)

				if(recent && recent.result === 'success' && recent.start + interval > unixNow()){
					await wait(1000)
					return
				}

				await this.repo.recordOperation(type, null, execute())
			}

			
		}
	}

}


export class RestProvider extends BaseProvider{
	constructor(name, cfg){
		super(name)

		this.api = new Rest({fetch, ...cfg})
	}
}

