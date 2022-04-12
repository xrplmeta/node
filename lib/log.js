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

	accumulateInfo(arg){
		return this.accumulate('I', arg)
	}

	time(key, ...contents){
		if(this.timings[key]){
			let time = process.hrtime(this.timings[key])
			let timeInMs = (time[0] * 1000000000 + time[1]) / 1000000
			let duration = humanDuration(timeInMs, 1)

			this.info(...contents.map(arg => typeof arg === 'string'
				? arg.replace('%', duration)
				: arg))

			delete this.timings[key]
		}else{
			this.timings[key] = process.hrtime()

			if(contents.length > 0)
				this.info(...contents)
		}
	}

	accumulate(level, { line, timeout = 10000, ...values }){
		if(!this.accumulation){
			this.accumulation = {
				start: Date.now(), 
				timeout,
				data: {}
			}

			setTimeout(() => {
				let data = { ...this.accumulation.data, time: humanDuration(timeout) }

				this.log(level, ...line.map(piece => {
					for(let [k, v] of Object.entries(data)){
						if(typeof(piece) === 'string')
							piece = piece.replace(`%${k}`, v.toLocaleString('en-US'))
					}

					return piece
				}))

				this.accumulation = undefined
			}, timeout)
		}

		for(let [k, v] of Object.entries(values)){
			this.accumulation.data[k] = (this.accumulation.data[k] || 0) + v
		}
	}
}


export default new Logger({
	name: 'main', 
	color: 'yellow'
})