import { findLedgerAt, getAvailableRange } from './utils.js'


export function sanitizeToken({ key }){
	return ({ ctx, ...args }) => {
		if(!args.hasOwnProperty(key))
			throw {
				type: `missingParam`,
				message: `No token specified.`,
				expose: true
			}

		let { currency, issuer } = args[key]
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
	
		return {
			...args,
			ctx,
			[key]: token,
		}
	}
}

export function sanitizeRange(){
	return ({ ctx, ...args }) => {
		let available = getAvailableRange({ ctx })
		let sequence
		let time

		if(args.hasOwnProperty('sequence')){
			sequence = minMaxRange({ 
				requested: args.sequence, 
				available: available.sequence 
			})
		}else if(args.hasOwnProperty('time')){
			time = minMaxRange({ 
				requested: args.time, 
				available: available.time 
			})

			sequence = {
				start: findLedgerAt({ ctx, time: time.start }).sequence,
				end: findLedgerAt({ ctx, time: time.end }).sequence,
			}
		}else{
			throw {
				type: `missingParam`,
				message: `This request is missing a sequence or time range.`,
				expose: true
			}
		}

		return {
			...args,
			ctx,
			sequence,
			time,
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