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

export function keySort(array, key, compare){
	let list = array.map(item => ({item, key: key(item)}))

	compare = compare || ((a, b) => a - b)

	return list
		.sort((a, b) => compare(a.key, b.key))
		.map(({item}) => item)
}

export function decimalCompare(a, b){
	if(a.gt(b))
		return 1
	else if(b.gt(a))
		return -1
	else
		return 0
}

decimalCompare.ASC = decimalCompare
decimalCompare.DESC = (a, b) => decimalCompare(b, a)


export function batched(items, batchSize){
	let batches = []

	for(let i=0; i<items.length; i+=batchSize){
		batches.push(items.slice(i, i + batchSize))
	}

	return batches
}


export function leftProximityZip(...blocks){
	let keyedBlocks = blocks.map(({array, key}) => array.map(item => ({item, key: key(item)})))
	let zipped = []
	let indices = Array(keyedBlocks.length).fill(0)


	for(let lead of keyedBlocks[0]){
		let pack = [lead.item]

		for(let k=1; k<keyedBlocks.length; k++){
			while(indices[k] < keyedBlocks[k].length - 1){
				let current = keyedBlocks[k][indices[k]].key
				let next = keyedBlocks[k][indices[k]+1].key


				if(Math.abs(lead.key - current) <= Math.abs(lead.key - next))
					break

				indices[k]++
			}

			pack.push(keyedBlocks[k][indices[k]]?.item)
		}

		zipped.push(pack)
	}

	return zipped
}


export function isObject(item) {
	return (item && typeof item === 'object' && !Array.isArray(item));
}


export function assignDeep(target, ...sources) {
	if (!sources.length) return target
	const source = sources.shift()

	if (isObject(target) && isObject(source)) {
		for (const key in source) {
			if (isObject(source[key])) {
				if (!target[key]) Object.assign(target, { [key]: {} })
				assignDeep(target[key], source[key])
			} else {
				Object.assign(target, { [key]: source[key] })
			}
		}
	}

	return assignDeep(target, ...sources)
}

export function deepCompare(obj1, obj2, reversed){
	for(let key in obj1){
		if(typeof obj1[key] === "object"){
			if(!deepCompare(obj1[key], obj2[key])) 
				return false
		}else if(obj1[key] !== obj2[key]) 
			return false
	}

	return reversed ? true : deepCompare(obj2, obj1, true)
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