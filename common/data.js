export function mapKey(items, key){
	let map = {}

	for(let item of items){
		map[item[key]] = item
	}

	return map
}


export function mapMultiKey(items, key, deleteKey){
	let map = {}

	for(let item of items){
		let k = item[key]

		if(!map[k])
			map[k] = []

		if(deleteKey){
			item = {...item}
			delete item[key]
		}

		map[k].push(item)
	}

	return map
}

export function pickBest(items, score){
	let best = {item: null, score: -Infinity}

	for(let item of items){
		let s = score(item)

		if(s > best.score){
			best.item = item
			best.score = s
		}
	}

	return best.item
}

export function keySort(array, key){
	let list = array.map(item => ({item, key: key(item)}))

	return list
		.sort((a, b) => a.key - b.key)
		.map(({item}) => item)
}

export function nestDotNotated(map){
	let nested = {}

	for(let [key, value] of Object.entries(map)){
		index(nested, key, value)
	}

	return nested
}



function index(obj, is, value) {
	if (typeof is == 'string')
		return index(obj, is.split('.'), value)
	else if (is.length === 1 && value !== undefined)
		return obj[is[0]] = value
	else if (is.length === 0)
		return obj
	else{
		let key = is[0]

		if(!obj[key])
			obj[key] = {}

		return index(obj[key], is.slice(1), value)
	}
}