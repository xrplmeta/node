import * as xls26 from '@xrplkit/xls26'
import { decodeCurrencyCode } from '@xrplkit/amount'

const linkmap = {
	twitter: [
		/https?:\/\/(?:www\.)?twitter\.com\/(\w{1,15})/
	]
}


export function parseXLS26(str){
	let { accounts, currencies } = xls26.parse(str)

	return {
		issuers: accounts
			.map(transform),
		tokens: currencies
			.map(transform)
			.map(({code, ...token}) => ({
				...token, 
				currency: decodeCurrencyCode(code)
			})),
	}
}

function transform({ links, ...meta }){
	let { websites, ...handles } = parseLinks(links || [])
	let transformed = {...meta, ...handles}

	if(websites)
		transformed.domain = websites[0]
			.replace(/^https?:\/\//, '')

	return transformed
}

function parseLinks(urls){
	let out = {}

	for(let url of urls){
		let unknown = true

		for(let [key, regexes] of Object.entries(linkmap)){
			if(out[key])
				continue

			for(let regex of regexes){
				let match = url.match(regex)

				if(!match || !match[1])
					continue

				out[key] = match[1]
				unknown = false
				break
			}
		}

		if(unknown){
			out.websites = [...(out.websites || []), url]
		}
	}

	return out
}