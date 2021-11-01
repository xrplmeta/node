import fetch from 'node-fetch'
import Rest from '../../common/rest.js'
import { wait } from '../../common/time.js'
import { log, pretty } from '../../common/logging.js'



export default class{
	constructor({repo, key, secret}){
		this.repo = repo
		this.api = new Rest({base: 'https://www.gravatar.com', fetch})
		this.log = log.for({name: 'gravatar', color: 'cyan'})
	}

	async run(interval){
		while(true){
			let todo = await this.repo.getNextDueIssuerForOperation('gravatar', interval, 'having-email')

			if(!todo){
				await wait(1000)
				continue
			}

			await this.repo.recordOperation('gravatar', todo.issuer, this.update(todo))
		}
	}

	async update({issuer, emailHash}){
		this.log(`checking avatar ${emailHash}`)

		let res = await this.api.get(`avatar/${emailHash.toLowerCase()}`, {d: 404}, {raw: true})
		let meta = {icon: null}

		if(res.status === 200){
			meta.icon = `https://www.gravatar.com/avatar/${emailHash.toLowerCase()}`
		}else if(res.status !== 404){
			throw {message: `HTTP Error ${res.status}`}
		}

		this.repo.setMeta({
			meta,
			type: 'issuer',
			subject: issuer,
			source: 'gravatar.com'
		})
	}
}