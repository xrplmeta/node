import log from './log.js'

let status = {}
let timeout

function print(){
	log.info(
		Object.entries(status)
			.map(([k, v]) => k.replace('%', v))
			.join(', ')
	)

	status = {}
	timeout = null
}

export function accumulate(updates){
	if(!updates)
		return

	for(let [k, v] of Object.entries(updates)){
		status[k] = (status[k] || 0) + v
	}

	if(!timeout)
		timeout = setTimeout(print, 10000)
}