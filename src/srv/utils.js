export function getAvailableRange({ ctx }){
	let newest = ctx.db.ledgers.readOne({
		orderBy: {
			sequence: 'asc'
		}
	})

	let oldest = ctx.db.ledgers.readOne({
		orderBy: {
			sequence: 'desc'
		}
	})

	return { newest, oldest }
}

export function deriveRange({ ctx, sequence, time }){
	let { newest, oldest } = getAvailableRange({ ctx })

	sequence = sequence || {}
	time = time || {}

	if(sequence.start !== undefined){
		sequence.start = Math.max(sequence.start, oldest.sequence)

		if(sequence.end < 0)
			sequence.end = Math.max(sequence.start, newest.sequence - sequence.end)
		else if(sequence.end > 0)
			sequence.end = Math.min(sequence.end, newest.sequence)
		else
			sequence.end = newest.sequence
	}else if(time.start !== undefined){
		time.start = Math.max(time.start, oldest.time)

		if(time.end < 0)
			time.end = Math.max(time.start, newest.time - time.end)
		else if(time.end > 0)
			time.end = Math.min(time.end, newest.time)
		else
			time.end = newest.time
	}else{
		throw {
			type: `missingRange`,
			message: `This request is missing a sequence or time range.`,
			expose: true
		}
	}

	return {
		sequence,
		time,
		partial: false
	}
}

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