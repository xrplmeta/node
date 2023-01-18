import EventEmitter from 'events'
import fetch from 'node-fetch'
import { RateLimiter } from 'limiter'
import { sanitize } from './url.js'


export function createFetch({ baseUrl, headers, ratelimit, timeout = 60 } = {}){
	let limiter = ratelimit 
		? new RateLimiter({
			tokensPerInterval: ratelimit, 
			interval: 'minute'
		}) 
		: null

	return async (url = '', options = {}) => {
		if(limiter)
			await limiter.removeTokens(1)
		
		let res
		let data
		let signal = new AbortSignal()
		let timeoutTimer = setTimeout(() => signal.emit('abort'), timeout * 1000)

		try{
			res = await fetch(
				sanitize(baseUrl ? `${baseUrl}/${url}` : url),
				{
					signal,
					headers: {
						...headers,
						...options.headers
					}
				}
			)
		}catch(error){
			throw error
		}finally{
			clearTimeout(timeoutTimer)
		}

		try{
			if(res.headers.get('content-type')?.includes('application/json')){
				data = await res.json()
			}else{
				data = await res.text()
			}
		}catch(e){
			data = null
			await res.blob()
		}

		return { 
			status: res.status,
			headers: res.headers,
			data
		}
	}
}

class AbortSignal extends EventEmitter{
	get [Symbol.toStringTag]() {
		return 'AbortSignal'
	}

	addEventListener(...args){
		this.on(...args)
	}

	removeEventListener(...args){
		this.off(...args)
	}
}