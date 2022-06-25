export function collapseMetas(metas, sourcePriority){
	let collapsed = {}

	for(let [key, values] of Object.entries(metas)){
		if(!values)
			continue

		if(Array.isArray(values)){
			let meta = values[0]

			if(meta.value)
				collapsed[key] = meta.value
		}else{
			collapsed[key] = collapseMetas(values, sourcePriority)
		}
	}

	return collapsed
}