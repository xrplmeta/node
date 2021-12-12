import { isMainThread, parentPort } from './worker_threads.polyfill.js'
import { humanDuration } from './time.js'

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
	E: ['debug', 'info', 'error'],
}

const formatContent = arg => {
	if(typeof arg === 'number')
		return arg.toLocaleString('en-US')

	if(arg && arg.stack)
		return arg.stack

	return arg
}

class Logger{
	constructor({name, color, level}){
		this.name = name
		this.color = color || 'yellow'
		this.level = level || 'debug'
		this.timings = {}
	}

	registerWorker(worker, config){
		worker.on('message', message => {
			if(message && message.type === 'log'){
				this.log.call({...config, level: this.level}, message.level, ...message.args)
			}
		})
	}

	log(level, ...args){
		if(isMainThread){
			if(!levelCascades[level].includes(this.level))
				return

			let func = level === 'E'
				? console.error
				: console.log
			let color = level === 'E'
				? 'red'
				: this.color
			let contents = args.map(formatContent)

			func(`${new Date().toISOString().slice(0,19).replace('T', ' ')} ${level} [\x1b[${logColors[color]}${this.name}\x1b[0m]`, ...contents)
		}else{
			parentPort.postMessage({type: 'log', level, args: args.map(formatContent)})
		}
	}

	debug(...contents){
		this.log('D', ...contents)
	}

	info(...contents){
		this.log('I', ...contents)
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


const defaultLogger = new Logger({name: 'main', color: 'yellow'})
const log = {
	debug: defaultLogger.debug.bind(defaultLogger),
	info: defaultLogger.info.bind(defaultLogger),
	error: defaultLogger.error.bind(defaultLogger),
	time: defaultLogger.time.bind(defaultLogger),
}

Object.defineProperty(log, 'level', {
	set: level => defaultLogger.level = level
})

export { Logger, log }