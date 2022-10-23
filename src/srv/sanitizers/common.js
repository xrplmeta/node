import { getAvailableRange, readLedgerAt } from '../../db/helpers/ledgers.js'

export function sanitizePoint({ clamp = false }){
	return ({ ctx, ...args }) => {
		let sequence
		let time

		if(clamp){
			let available = getAvailableRange({ ctx })

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
		}else{
			if(args.hasOwnProperty('sequence')){
				sequence = args.sequence
			}else if(args.hasOwnProperty('time')){
				time = args.time
			}else{
				throw {
					type: `missingParam`,
					message: `This request is missing a ledger sequence or a timestamp.`,
					expose: true
				}
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

export function sanitizeRange({ withInterval = false } = {}){
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

export function sanitizeSourcePreferences(){
	return ({ ctx, prefer_sources, ...args }) => {
		if(prefer_sources){
			if(!Array.isArray(prefer_sources)){
				throw {
					type: `invalidParam`,
					message: `The preferred sources need to be specified as an array.`,
					expose: true
				}
			}

			for(let source of prefer_sources){
				if([
					'ledger',
					'xrplmeta',
					'xumm',
					'domain',
					'bithomp',
					'xrpscan',
					'twitter',
					'gravatar'
				].includes(source))
					continue

				if(ctx.config.crawl?.tokenlist){
					if(
						ctx.config.crawl?.tokenlist.some(
							list => list.id === source
						)
					)
						continue
				}

				throw {
					type: `invalidParam`,
					message: `The preferred source "${source}" does not exist.`,
					expose: true
				}
			}

		}

		return {
			...args,
			ctx,
			prefer_sources
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