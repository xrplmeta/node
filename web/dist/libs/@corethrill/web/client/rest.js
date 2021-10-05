import Restapy from 'restapy'

export default class extends Restapy{
	constructor(config, prefetched, dispatch){
		super(config)
		this.prefetched = prefetched
		this.dispatch = dispatch
	}

	extend(...args){
		let extended = super.extend(...args)

		extended.prefetched = this.prefetched
		extended.dispatch = this.dispatch

		return extended
	}

	async get(...args){
		let url = args[0]
		let pfi = this.prefetched.findIndex(p => p.url === url)

		if(pfi >= 0){
			return this.prefetched.splice(pfi, 1)[0].data
		}

		return await super.get(...args)
	}

	makeRequest(...args){
		return super.makeRequest(...args)
			.then(res => {
				this.dispatch()
				return res
			})
			.catch(err => {
				this.dispatch()
				throw err
			})
	}
}