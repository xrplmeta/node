import log from './log.js'

let status = {}
let timeout

export function accumulate(updates){
	if(!updates)
		return

	for(let [k, v] of Object.entries(updates)){
		status[k] = (status[k] || 0) + v
	}

	if(!timeout)
		timeout = setTimeout(flush, 10000)
}

export function flush(){
	log.info(
		Object.entries(status)
			.map(([k, v]) => k.replace('%', v.toLocaleString('en-US')))
			.join(', ')
	)

	status = {}
	timeout = null
}