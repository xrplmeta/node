export function sanitize(str){
	return str.slice(0, 8) + str.slice(8)
		.replace(/\/\//g,'/')
		.replace(/\/\.$/, '')
		.replace(/\/$/, '')
		.replace(/\?$/, '')
}