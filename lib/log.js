const logColors = {
	red: '31m',
	green: '32m',
	yellow: '33m',
	blue: '34m',
	cyan: '36m',
}

const levelCascades = {
	D: ['debug'],
	I: ['debug', 'info'],
	W: ['debug', 'info', 'warn'],
	E: ['debug', 'info', 'warn', 'error'],
}

const timeScalars = [
	1000, 
	60, 
	60, 
	24, 
	7, 
	52
]

const timeUnits = [
	'ms', 
	'seconds', 
	'minutes', 
	'hours', 
	'days', 
	'weeks', 
	'years'
]

const formatContent = arg => {
	if(typeof arg === 'number')
		return arg.toLocaleString('en-US')

	if(arg && arg.stack)
		return arg.stack

	return arg
}

const humanDuration = (ms, dp = 0) => {
	let timeScalarIndex = 0
	let scaledTime = ms

	while (scaledTime > timeScalars[timeScalarIndex]){
		scaledTime /= timeScalars[timeScalarIndex++]
	}

	return `${scaledTime.toFixed(dp)} ${timeUnits[timeScalarIndex]}`
}

export class Logger{
	constructor(config){
		this.config(config)
		this.timings = {}
	}

	branch(config){
		return new Logger({
			isSubprocess: this.isSubprocess,
			...config
		})
	}

	config({name, color, severity, isSubprocess}){
		this.name = name
		this.color = color || 'yellow'
		this.severity = severity || 'debug'
		this.isSubprocess = isSubprocess || false
	}

	subprocess(subprocess){
		subprocess.on('message', message => {
			if(message && message.type === 'log'){
				this.log.call(
					{...message.config, severity: this.severity}, 
					message.level, 
					...message.args
				)
			}
		})
	}

	log(level, ...args){
		if(this.isSubprocess){
			process.send({
				type: 'log', 
				config: {
					name: this.name,
					color: this.color
				},
				level, 
				args: args.map(formatContent)
			})
			return
		}

		if(!levelCascades[level].includes(this.severity))
			return

		let output = level === 'E'
			? console.error
			: console.log

		let color = level === 'E'
			? 'red'
			: this.color
			
		let contents = args.map(formatContent)

		output(`${new Date().toISOString().slice(0,19).replace('T', ' ')} ${level} [\x1b[${logColors[color]}${this.name}\x1b[0m]`, ...contents)
	}

	debug(...contents){
		this.log('D', ...contents)
	}

	info(...contents){
		this.log('I', ...contents)
	}

	warn(...contents){
		this.log('W', ...contents)
	}

	error(...contents){
		this.log('E', ...contents)
	}

	// todo: make this utilize high resolution time
	time(key, ...contents){
		if(this.timings[key]){
			let passed = Date.now() - this.timings[key]
			let duration = humanDuration(passed, 1)

			this.info(...contents.map(arg => typeof arg === 'string'
				? arg.replace('%', duration)
				: arg))

			delete this.timings[key]
		}else{
			this.timings[key] = Date.now()

			if(contents.length > 0)
				this.info(...contents)
		}
	}
}


export default new Logger({
	name: 'main', 
	color: 'yellow'
})