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

log.for = (name, color) => log.bind(null, {name, color})



export function pretty(thing){
	if(typeof thing === 'number')
		return thing.toLocaleString('en-US')

	return thing
}
