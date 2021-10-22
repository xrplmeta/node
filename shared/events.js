function EventEmitter(){
	this.listeners = []
	this.dispatched = []
}

EventEmitter.prototype.on = function(type,callback){
	var listener = {type:type,callback:callback}
	this.listeners.push(listener)
}

EventEmitter.prototype.once = function(type,callback){
	var listener = {type:type,callback:callback,once:true}
	this.listeners.push(listener)
}

EventEmitter.prototype.when = function(type,callback,keep){
	if(this.dispatched.indexOf(type)!=-1){
		callback()
		if(!keep)
			return
	}
	var listener = {type:type,callback:callback,once:!keep,when:true}
	this.listeners.push(listener)
}

EventEmitter.prototype.off = function(type,callback){
	for(var i in this.listeners){
		if(this.listeners[i].type==type){
			if(!callback || this.listeners[i].callback==callback)
				this.listeners.splice(i,1)
		}
	}
}

EventEmitter.prototype.emit = function(type,data){
	if(this.dispatched.indexOf(type)==-1)
		this.dispatched.push(type)

	for(var i=0;i<this.listeners.length;i++){
		if(i<0)
			continue
		if(this.listeners[i].type==type){
			this.listeners[i].callback.apply(null,Array.prototype.slice.call(arguments,1))
			if(this.listeners[i] && this.listeners[i].once){
				this.listeners.splice(i,1)
				i--
			}
		}
	}
}

export default EventEmitter