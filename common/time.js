export function wait(ms){
	return new Promise(resolve => setTimeout(resolve, ms))
}

export function unixNow(){
	return Math.floor(Date.now() / 1000)
}

export function rippleNow(){
	return unixNow() - 946684800
}

export function laxHumanDuration(seconds){
	if(seconds < 1)
		return `less than a second`
	else if(seconds < 60)
		return `less than a minute`
	else if(seconds < 60 * 60)
		return `less than an hour`
	else if(seconds < 60 * 60 * 24)
		return `less than a day`
	else if(seconds < 60 * 60 * 24 * 7)
		return `less than a week`
	else if(seconds < 60 * 60 * 24 * 30 * 2)
		return `less than ${Math.ceil(seconds / (60 * 60 * 24 * 7))} weeks`
	else if(seconds < 60 * 60 * 24 * 365 * 2)
		return `about ${Math.ceil(seconds / (60 * 60 * 24 * 30))} months`
	else if(seconds < 60 * 60 * 24 * 365 * 1000)
		return `about ${Math.round(seconds / (60 * 60 * 24 * 365))} years`
	else
		return `over 1,000 years`
}