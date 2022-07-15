import { getAvailableRange, readLedgerAt } from '../../db/helpers/ledgers.js'

export function sanitizePoint(){
	return ({ ctx, ...args }) => {
		let available = getAvailableRange({ ctx })
		let sequence
		let time

		if(args.hasOwnProperty('sequence')){
			sequence = Math.min(
				Math.max(
					args.sequence, 
					available.sequence.start
				), 
				available.sequence.end
			)
		}else if(args.hasOwnProperty('time')){
			time = Math.min(
				Math.max(
					args.time, 
					available.time.start
				), 
				available.time.end
			)

			sequence = readLedgerAt({ ctx, time }).sequence
		}else{
			throw {
				type: `missingParam`,
				message: `This request is missing a ledger sequence or a timestamp.`,
				expose: true
			}
		}

		return {
			...args,
			ctx,
			sequence,
			time
		}
	}
}

export function sanitizeRange({ withInterval = false }){
	return ({ ctx, ...args }) => {
		let available = getAvailableRange({ ctx })
		let sequence
		let time
		let interval

		if(args.hasOwnProperty('sequence')){
			sequence = minMaxRange({ 
				requested: args.sequence, 
				available: available.sequence 
			})

			if(withInterval){
				if(args.sequence.hasOwnProperty('interval')){
					sequence.interval = parseInt(args.sequence.interval)
				}else{
					throw {
						type: `missingParam`,
						message: `This request is missing sequence interval specification.`,
						expose: true
					}
				}
			}
		}else if(args.hasOwnProperty('time')){
			time = minMaxRange({ 
				requested: args.time, 
				available: available.time 
			})

			if(withInterval){
				if(args.time.hasOwnProperty('interval')){
					time.interval = parseInt(args.time.interval)
				}else{
					throw {
						type: `missingParam`,
						message: `This request is missing time interval specification.`,
						expose: true
					}
				}
			}

			sequence = {
				start: readLedgerAt({ ctx, time: time.start }).sequence,
				end: readLedgerAt({ ctx, time: time.end }).sequence,
			}
		}else{
			throw {
				type: `missingParam`,
				message: `This request is missing a sequence or time range.`,
				expose: true
			}
		}

		if(withInterval){
			if((sequence?.interval || time?.interval) <= 0){
				throw {
					type: `invalidParam`,
					message: `The interval has to be greater than zero.`,
					expose: true
				}
			}
		}

		return {
			...args,
			ctx,
			sequence,
			time,
			interval
		}
	}
}

export function sanitizeLimitOffset({ defaultLimit, maxLimit }){
	return ({ ctx, limit, offset, ...args }) => {
		return {
			...args,
			ctx,
			limit: limit
				? Math.min(parseInt(limit), maxLimit)
				: defaultLimit,
			offset: offset
				? parseInt(offset)
				: undefined
		}
	}
}


function minMaxRange({ requested, available }){
	let start
	let end

	if(requested.start !== undefined){
		if(requested.start < 0)
			start = Math.min(requested.start + available.start, available.end)
		else
			start = Math.min(Math.max(requested.start, available.start), available.end)
	}else{
		start = available.start
	}

	if(requested.end !== undefined){
		if(requested.end < 0)
			end = Math.max(requested.end + available.end, available.start)
		else
			end = Math.min(Math.max(requested.start, available.start), available.end)
	}else{
		end = available.end
	}

	return { start, end }
}