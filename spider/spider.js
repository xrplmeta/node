import { log, wait } from '../shared/utils.js'


export default class{
	constructor(repo){
		this.repo = repo
		this.log = log.for({name: 'spider', color: 'cyan'})
	}

	async crawl(){
		this.log('starting crawling')

		while(true){
			await wait(1000)
		}
	}
}