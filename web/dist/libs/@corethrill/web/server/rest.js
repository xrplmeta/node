import Restapy from 'restapy'

export default class extends Restapy{
	constructor(config, cache){
		super(config)
		this.cache = []

	}

	extend(...args){
		let extended = super.extend(...args)

		extended.cache = this.cache

		return extended
	}

	async get(...args){
		let url = args[0]
		let data = await super.get(...args)

		this.cache.push({url, data})

		return data
	}

	async post(...args){
		return await super.post(...args)
	}
}