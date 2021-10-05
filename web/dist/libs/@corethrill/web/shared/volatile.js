export default class{
	constructor(){
		this.data = {}
	}

	get(key, fill){
		if(!this.data[key])
			this.data[key] = fill

		return this.data[key]
	}
}