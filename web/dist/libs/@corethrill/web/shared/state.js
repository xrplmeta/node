export default class{
	constructor(data){
		Object.assign(this, data)
		this.__clientOnlyKeys = []
	}

	has(key){
		return this.hasOwnProperty(key)
	}

	get(key){
		return this[key]
	}

	set(key, value, clientOnly){
		this[key] = value

		if(clientOnly)
			this.__clientOnlyKeys.push(key)
	}

	getOrSet(key, ...args){
		let clientOnly = false
		let value

		if(args.length === 2){
			clientOnly = args[0]
			value = args[1]
		}else{
			value = args[0]
		}

		if(this.has(key))
			return this.get(key)
		
		this.set(key, value, clientOnly)
		return value
	}

	delete(key){
		delete this[key]
		delete this.__clientOnlyKeys[key]
	}

	toString(){
		let {__clientOnlyKeys, ...data} = {...this}

		__clientOnlyKeys.forEach(key => delete data[key])

		return JSON.stringify(data)
	}
}