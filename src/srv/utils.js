export function getAvailableRange({ ctx }){
	let start = ctx.db.ledgers.readOne({
		orderBy: {
			sequence: 'asc'
		}
	})

	let end = ctx.db.ledgers.readOne({
		orderBy: {
			sequence: 'desc'
		}
	})

	return {
		sequence: {
			start: start.sequence,
			end: end.sequence
		},
		time: {
			start: start.closeTime,
			end: end.closeTime
		}
	}
}

export function deriveRange({ ctx, sequence, time }){
	let available = getAvailableRange({ ctx })

	sequence = sequence || {}
	time = time || {}

	if(sequence.start !== undefined){
		sequence.start = Math.max(sequence.start, available.sequence.start)

		if(sequence.end < 0)
			sequence.end = Math.max(sequence.start, available.sequence.start - sequence.end)
		else if(sequence.end > 0)
			sequence.end = Math.min(sequence.end, available.sequence.end)
		else
			sequence.end = available.sequence.end
	}else if(time.start !== undefined){
		time.start = Math.max(time.start, available.time.start)

		if(time.end < 0)
			time.end = Math.max(time.start, available.time.start - time.end)
		else if(time.end > 0)
			time.end = Math.min(time.end, available.time.end)
		else
			time.end = available.time.end
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

export function readToken({ ctx, currency, issuer }){
	let token = ctx.db.tokens.readOne({
		where: {
			currency,
			issuer: {
				address: issuer
			}
		}
	})

	if(!token){
		throw {
			type: `entryNotFound`,
			message: `The token '${currency}' issued by '${issuer}' does not exist.`,
			expose: true
		}
	}

	return token
}

export function readTokenMetricSeries({ ctx, table, token, range, interval }){
	return ctx.db[table].readMany({
		where: {
			RAW: {
				text: `token = ? AND (
					ledgerSequence IN (
						SELECT MAX(ledgerSequence)
						FROM ${table}
						WHERE token = ?
						AND ledgerSequence >= ?
						AND ledgerSequence <= ?
						GROUP BY ledgerSequence / CAST(? as INTEGER)
					)
					OR 
					ledgerSequence = (
						SELECT MAX(ledgerSequence)
						FROM ${table}
						WHERE token = ?
						AND ledgerSequence < ?
					)
				)`,
				values: [
					token.id,
					token.id,
					range.start,
					range.end,
					interval,
					token.id,
					range.start
				]
			}
		},
		orderBy: {
			ledgerSequence: 'asc'
		}
	})
		.map(row => ({
			sequence: Number(row.ledgerSequence), 
			value: row.value.toString() 
		}))
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