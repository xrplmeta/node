import fs from 'fs'
import toml from 'toml'

export function load(path){
	let config = toml.parse(fs.readFileSync(path).toString())
	let adjusted = {}

	for(let [key, directive] of Object.entries(config)){
		adjusted[key.toLowerCase()] = camelify(directive)
	}

	return adjusted
}

export function override(config, args){
	let apply = (conf, key, value) => {
		let parts = key.split('.')

		if(parts.length > 1){
			return apply(conf[parts[0]], parts.slice(1).join('.'), value)
		}else{
			return {...conf, [key]: value}
		}
	}

	for(let [key, value] of Object.entries(args)){
		if(key.startsWith('config.')){
			config = apply(config, key.slice(7), value)
		}
	}

	return config
}

function camelify(obj){
	if(Array.isArray(obj))
		return obj.map(o => camelify(o))

	if(typeof obj === 'object'){
		let camelified = {}

		for(let [key, value] of Object.entries(obj)){
			if(key === key.toUpperCase()){
				key = key.toLowerCase()
				value = camelify(value)
			}else{
				key = key.replace(/_([a-z])/g, match => match[1].toUpperCase())
			}

			camelified[key] = value
		}

		return camelified
	}

	return obj
}