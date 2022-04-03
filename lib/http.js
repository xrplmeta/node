import fetch from 'node-fetch'
import { RateLimiter } from 'limiter'


export function createFetch({ baseUrl, headers, ratelimit }){
	let limiter = ratelimit 
		? new RateLimiter({
			tokensPerInterval: ratelimit, 
			interval: 'minute'
		}) 
		: null

	return async (url = '', options = {}) => {
		if(limiter)
			await limiter.removeTokens(1)

		let data
		let res = await fetch(
			sanitizeUrl(`${baseUrl}/${url}`),
			{
				headers: {
					...headers,
					...options.headers
				}
			}
		)

		try{
			if(res.headers.get('content-type').includes('application/json')){
				data = await res.json()
			}else{
				data = await res.text()
			}
		}catch{
			data = null
		}

		return { 
			status: res.status,
			headers: res.headers,
			data
		}
	}
}

export function sanitizeUrl(str){
	return str.slice(0, 8) + str.slice(8)
		.replace(/\/\//g,'/')
		.replace(/\/\.$/, '')
		.replace(/\/$/, '')
		.replace(/\?$/, '')
}