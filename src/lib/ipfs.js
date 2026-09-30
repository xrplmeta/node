export const gateways = [
	'ipfs.filebase.io',
	'apac.orbitor.dev',
	'latam.orbitor.dev',
	'ipfs.orbitor.dev',
	'dget.top'
]

export function parse(url){
	let match = url.match(/^ipfs:\/\/(.+)$/)
		|| url.match(/^https?:\/\/([^/]+)\/ipfs\/(.+)$/)

	if(!match)
		return

	return {
		gateway: match.length === 3 ? match[1] : undefined,
		path: match[match.length - 1].replace(/^ipfs\//, '')
	}
}

export function pickGatewayURL({ path, exclude }){
	let candidates = gateways.filter(gateway => gateway !== exclude)
	let gateway = candidates[Math.floor(Math.random() * candidates.length)]

	return `https://${gateway}/ipfs/${path}`
}
