const timeScalars = [1000, 60, 60, 24, 7, 52]
const timeUnits = ['ms', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'years']
const rippleEpochOffset = 946684800

export function humanDuration(ms, dp = 0){
	let timeScalarIndex = 0
	let scaledTime = ms

	while (scaledTime > timeScalars[timeScalarIndex]){
		scaledTime /= timeScalars[timeScalarIndex++]
	}

	return `${scaledTime.toFixed(dp)} ${timeUnits[timeScalarIndex]}`
}

export function rippleNow(){
	return unixNow() - rippleEpochOffset
}

export function rippleToUnix(timestamp){
	return timestamp + rippleEpochOffset
}

export function wait(ms){
	return new Promise(resolve => setTimeout(resolve, ms))
}

export function unixNow(){
	return Math.floor(Date.now() / 1000)
}

export function onceAndForAll(func){
	let promise

	return async (...args) => {
		if(!promise)
			promise = func(...args)

		return await promise
	}
}