import EventEmitter from 'events'
import createSocket from '@xrplkit/socket'
import log from '@mwni/log'


export default class Node extends EventEmitter{
	constructor(config){
		super()

		this.name = config.url
			.replace(/^wss?:\/\//, '')
			.replace(/:[0-9]+/, '')

		this.tasks = []
		this.socket = createSocket({ url: config.url, apiVersion: 2 })
		this.availableLedgers = []
		this.rateLimitedUntil = 0

		this.socket.on('transaction', tx => {
			this.emit('event', {hash: tx.hash, tx})
		})

		this.socket.on('ledgerClosed', ledger => {
			this.emit('event', {hash: ledger.ledger_hash, ledger})
			this.hasReportedClosedLedger = true

			if(ledger.validated_ledgers){
				this.availableLedgers = ledger.validated_ledgers
					.split(',')
					.map(range => range
						.split('-')
						.map(i => parseInt(i))
					)
			}
		})

		this.socket.on('open', async () => {
			this.hasReportedClosedLedger = false
			this.emit('connected')

			try{
				await this.socket.request({
					command: 'subscribe',
					streams: ['ledger', 'transactions']
				})
			}catch(error){
				log.warn(`failed to subscribe to node "${this.name}":`)
				log.warn(error)
			}
		})

		this.socket.on('close', async event => {
			this.error = event.reason 
				? event.reason
				: `code ${event.code}`

			this.emit('disconnected')
		})

		this.socket.on('error', error => {
			this.error = error.message 
				? error.message
				: `unknown connection failure`

			this.emit('error')
		})

		this.socket.on('backoff', ({ delay, hits }) => {
			this.emit('backoff', { delay, hits })
		})
	}

	get status(){
		return {
			connected: this.socket.connected,
			connectionError: this.socket.connectionError,
			rateLimited: this.socket.rateLimited || this.inCooldown,
			nextReconnectDelay: this.socket.nextReconnectDelay,
			cooldownRemaining: Math.max(0, this.rateLimitedUntil - Date.now()),
			openRequests: this.socket.requests
		}
	}

	get inCooldown(){
		return Date.now() < this.rateLimitedUntil
	}

	bid(payload){
		if(this.busy || !this.socket.connected || !this.hasReportedClosedLedger)
			return 0

		if(this.inCooldown && payload.command)
			return 0

		if(payload.command){
			if(payload.ticket){
				if(this.tasks.some(task => task.ticket === payload.ticket))
					return Infinity
				else
					return 0
			}

			if(payload.ledger_index && this.availableLedgers.length > 0){
				let hasLedger = payload.ledger_index === 'validated' || this.availableLedgers.some(
					([start, end]) => payload.ledger_index >= start && payload.ledger_index <= end
				)

				if(hasLedger)
					return 2
				else
					return 0
			}

			return 1
		}else if(payload.type === 'reserveTicket'){
			if(payload.node){
				if(payload.node !== this.name)
					return 0
			}

			return 1
		}
	}

	async do(payload){
		this.busy = true

		try{
			if(payload.command){
				return await this.socket.request(payload)
			}else if(payload.type === 'reserveTicket'){
				let ticket = Math.random()
					.toString(16)
					.toUpperCase()
					.slice(2, 10)
	
				this.tasks.push({
					type: payload.task,
					ticket,
					node: this.name
				})
	
				return {ticket}
			}
		}catch(error){
			let rateLimit = parseRateLimitError(error)

			if(rateLimit){
				this.rateLimitedUntil = Date.now() + rateLimit.retryAfter
				this.emit('ratelimit', { retryAfter: rateLimit.retryAfter, message: rateLimit.message })

				throw Object.assign(new Error(rateLimit.message), {
					rateLimited: true,
					retryAfter: rateLimit.retryAfter
				})
			}

			throw error
		}finally{
			this.busy = false
		}
	}

	disconnect(){
		this.socket.close()
	}
}


const defaultRateLimitRetry = 10000

function parseRateLimitError(error){
	let message = [
		error?.message,
		error?.error_message,
		error?.error,
		error?.error_exception
	]
		.filter(v => typeof v === 'string')
		.join(' ')

	if(!/rate limit|slowDown|tooBusy|\b429\b/i.test(message))
		return

	let retryAfter = defaultRateLimitRetry
	let match = message.match(/retry in ~?(\d+)\s*(ms|s)/i)

	if(match){
		retryAfter = parseInt(match[1]) * (match[2].toLowerCase() === 's' ? 1000 : 1)
	}else if(error?.retry_after_ms){
		retryAfter = error.retry_after_ms
	}

	return { retryAfter: retryAfter + 250, message }
}