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



export function currencyCodeForHumans(code){
	if(code.length === 3)
		return code

	let readable = ''

    for (let i = 0; i < code.length; i += 2) {
        readable += String.fromCharCode(parseInt(code.substr(i, 2), 16))
    }

    return decodeURIComponent(escape(readable))
}

export function unixNow(){
	return Math.floor(Date.now() / 1000)
}

export function rippleNow(){
	return unixNow() - 946684800
}