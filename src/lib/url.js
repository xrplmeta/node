import { parse } from 'url'

export function sanitize(url){
	return url.slice(0, 8) + url.slice(8)
		.replace(/\/\//g,'/')
		.replace(/\/\.$/, '')
		.replace(/\/$/, '')
		.replace(/\?$/, '')
}

export function validate(url){
	let { protocol, hostname } = parse(url)

	if(protocol !== 'http:' && protocol !== 'https:')
		return false

	if(hostname === 'localhost')
		return false

	if(hostname.includes(':'))
		return false

	if(!/[a-zA-Z]/.test(hostname))
		return false

	return true
}