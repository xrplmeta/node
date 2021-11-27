import fs from 'fs'
import toml from 'toml'

export function load(path){
	let config = toml.parse(fs.readFileSync('config.toml').toString())
	let adjusted = {}

	for(let [key, directive] of Object.entries(config)){
		adjusted[key.toLowerCase()] = camelify(directive)
	}

	return adjusted
}

function camelify(obj){
	if(Array.isArray(obj))
		return obj.map(o => camelify(o))

	let camelified = {}

	for(let [key, value] of Object.entries(obj)){
		let camelKey = key.replace(/_([a-z])/g, match => match[1].toUpperCase())

		camelified[camelKey] = value
	}

	return camelified
}