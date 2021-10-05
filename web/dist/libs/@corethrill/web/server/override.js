export default function(blueprint, overrides){
	return assignDeep(blueprint, overrides)
}

function assignDeep(...objects) {
	var output = {}
	var target = objects[0]
	var source = objects[1] || {}
	var keys = Object.keys(target).concat(Object.keys(source)).filter(function (value,index,self){
		return self.indexOf(value) === index;
	})

	for(var i=0;i<keys.length;i++){
		var key = keys[i]
		if(source.hasOwnProperty(key)){
			if(target.hasOwnProperty(key) && isObject(target[key])){
				output[key] = isObject(source[key]) ? assignDeep(target[key],source[key]) : source[key]
			}else
				output[key] = isObject(source[key]) ? assignDeep(source[key]) : source[key]
		}else{
			output[key] = isObject(target[key]) ? assignDeep(target[key]) : target[key]
		}
	}
	if(objects.length>2)
		return assignDeep(output,...objects.slice(2))
	else
		return output
}

function isObject(val){
	return val != null && typeof val === 'object' && Array.isArray(val) === false
}