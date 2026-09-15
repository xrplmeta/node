import log from '@mwni/log'


const sweepInterval = 60 * 1000
const bucketExpiry = 5 * 60 * 1000


export function createRateLimiter({ ctx }){
	let {
		ratelimitBucketSize: bucketSize = 0,
		ratelimitRefillPerSecond: refillPerSecond = 10,
		ratelimitWhitelist: whitelist = []
	} = ctx.config.server

	let enabled = bucketSize > 0
	let buckets = new Map()

	if(enabled){
		log.info(`rate limiting enabled (bucket size ${bucketSize}, refill ${refillPerSecond}/s)`)

		setInterval(
			() => {
				let now = Date.now()

				for(let [ip, bucket] of buckets){
					if(now - bucket.updatedAt > bucketExpiry)
						buckets.delete(ip)
				}
			},
			sweepInterval
		).unref()
	}

	return {
		enabled,

		consume({ ip, cost }){
			if(!enabled || !ip || cost <= 0 || whitelist.includes(ip))
				return { allowed: true }

			let now = Date.now()
			let bucket = buckets.get(ip)

			if(!bucket){
				bucket = { points: bucketSize, updatedAt: now }
				buckets.set(ip, bucket)
			}

			bucket.points = Math.min(
				bucketSize,
				bucket.points + (now - bucket.updatedAt) / 1000 * refillPerSecond
			)
			bucket.updatedAt = now

			if(bucket.points < cost){
				let retryAfter = Math.ceil((cost - bucket.points) / refillPerSecond)

				log.accumulate.info({
					text: [`%rateLimited request(s) rate limited in %time`],
					data: {
						rateLimited: 1
					}
				})

				return {
					allowed: false,
					retryAfter,
					remaining: Math.floor(bucket.points)
				}
			}

			bucket.points -= cost

			return {
				allowed: true,
				remaining: Math.floor(bucket.points)
			}
		}
	}
}

export function resolveCost(func, params){
	let cost = func.cost ?? 1

	if(typeof cost === 'function'){
		try{
			cost = cost(params || {})
		}catch{
			cost = 1
		}
	}

	return Number.isFinite(cost) ? Math.max(0, cost) : 1
}

export function resolveClientIp({ ctx, req, fallback }){
	let header = ctx.config.server.ratelimitRealIpHeader

	if(header){
		let value = req.headers[header.toLowerCase()]

		if(value){
			let ip = Array.isArray(value)
				? value[0]
				: value.split(',')[0]

			ip = ip.trim()

			if(ip)
				return ip
		}
	}

	return fallback
}

export function throwRateLimited(result){
	throw {
		type: 'rateLimited',
		message: `Rate limit exceeded. Try again in ${result.retryAfter} second(s).`,
		retry_after: result.retryAfter,
		rateLimited: true,
		expose: true
	}
}
