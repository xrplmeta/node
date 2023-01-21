import log from '@mwni/log'
import EventEmitter from 'events'
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
		let controller = new AbortController()
		let timeoutTimer = setTimeout(() => controller.abort(), timeout * 1000)
		let sanitizedUrl = sanitize(baseUrl ? `${baseUrl}/${url}` : url)

		try{
			res = await fetch(
				sanitizedUrl,
				{
					signal: controller.signal,
					headers: {
						...headers,
						...options.headers
					}
				}
			)

			if(res.headers.get('content-type')?.includes('application/json')){
				data = await res.json()
			}else{
				data = await res.text()
			}
		}catch(e){
			log.info(`fetch ${sanitizedUrl} failed: \n`, e)
			data = null
			await res.blob()
		}finally{
			clearTimeout(timeoutTimer)
		}

		return { 
			status: res.status,
			headers: res.headers,
			data
		}
	}
}