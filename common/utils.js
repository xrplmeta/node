const logColors = {
	red: '31m',
	green: '32m',
	yellow: '33m',
	blue: '34m',
	cyan: '36m',
}


export function log(who, ...contents){
	console.log(`[\x1b[${logColors[who.color]}${who.name}\x1b[0m]`, ...contents)
}

log.for = who => log.bind(null, who)


export function wait(ms){
	return new Promise(resolve => setTimeout(resolve, ms))
}


export function pretty(thing){
	if(typeof thing === 'number')
		return thing.toLocaleString('en-US')

	return thing
}


export function currencyCodeForHumans(code){
	if(code.length === 3)
		return code

	let readable = ''

	for (let i = 0; i < code.length; i += 2) {
		readable += String.fromCharCode(parseInt(code.substr(i, 2), 16))
	}

	try{
		return decodeURIComponent(escape(readable)).replace(/\u0000/g, '')
	}catch{
		return code
	}
}

export function unixNow(){
	return Math.floor(Date.now() / 1000)
}

export function rippleNow(){
	return unixNow() - 946684800
}