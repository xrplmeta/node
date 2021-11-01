import fetch from 'node-fetch'
import Rest from '../../common/rest.js'
import { wait } from '../../common/time.js'



export class BaseProvider{
	async loopSuperOperation(type, interval, execute){
		while(true){
			await wait(250)

			if(!await this.repo.isOperationDue(type, '*', interval))
				continue

			await this.repo.recordOperation(type, '*', execute())
		}
	}
}


export class RestProvider extends BaseProvider{
	constructor(cfg){
		this.api = new Rest({fetch, ...cfg})
	}
}

