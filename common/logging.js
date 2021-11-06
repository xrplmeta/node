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

log.replace = (who, ...contents) => {
	process.stdout.write(`[\x1b[${logColors[who.color]}${who.name}\x1b[0m] ${contents.join(' ')}\r`)
}

log.for = (name, color) => {
	let bound = log.bind(null, {name, color})

	bound.replace = log.replace.bind(null, {name, color})

	return bound
}





export function pretty(thing){
	if(typeof thing === 'number')
		return thing.toLocaleString('en-US')

	return thing
}
