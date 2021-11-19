import { fork } from 'child_process'
import EventEmitter from 'events'

let isMainThread = true
let workerData = null
let parentPort = null

if(process.argv[2] === '--worker-polyfilled'){
	isMainThread = false
	workerData = JSON.parse(JSON.parse(process.argv[3]))
	parentPort = {
		postMessage: message => process.send(message),
		on: (event, callback) => process.on(event, callback)
	}
}


class Worker extends EventEmitter{
	constructor(file, options){
		super()

		this.process = fork(file, ['--worker-polyfilled', JSON.stringify(JSON.stringify(options.workerData))])
		this.process.on('message', message => this.emit('message', message))
		this.process.on('error', error => this.emit('error', error))
		this.process.on('exit', code => this.emit('exit', code))
	}

	postMessage(message){
		this.process.send(message)
	}
}

export { Worker, isMainThread, parentPort, workerData}