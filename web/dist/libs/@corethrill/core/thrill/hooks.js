export default {
	postHooks: {},
	addPost: function(hook, func){
		if(!this.postHooks[hook])
			this.postHooks[hook] = []

		this.postHooks[hook].push(func)
	},
	hasPost: function(hook){
		return !!this.postHooks[hook]
	},
	callPost: function(hook, ret, args){
		for(let func of this.postHooks[hook]){
			ret = func.call(args[0], ret, ...args)
		}

		return ret
	}
}