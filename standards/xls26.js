import { parse as parseToml } from '../lib/toml.js'

const issuerFields = [
	'address',
	'name',
	'trusted',
	'description',
	'icon',
	'domain',
	'twitter',
	'telegram',
	'discord',
	'youtube',
	'facebook',
	'reddit',
	'medium',
]

const currencyFields = [
	'code',
	'issuer',
	'name',
	'trusted',
	'description',
	'icon',
	'domain',
	'twitter',
	'telegram',
	'discord',
	'youtube',
	'facebook',
	'reddit',
	'medium',
]


export function parse(str){
	let toml = parseToml(str)
	let issuers = []
	let currencies = []

	if(toml.issuers){
		for(let issuer of toml.issuers){
			issuers.push(
				Object.entries(issuer)
					.reduce((clean, [key, value]) => 
						issuerFields.includes(key)
							? {...clean, [key]: value}
							: clean
					,{})
			)
		}

		for(let currency of toml.currencies){
			currencies.push(
				Object.entries(currency)
					.reduce((clean, [key, value]) => 
						currencyFields.includes(key)
							? {...clean, [key]: value}
							: clean
					,{})
			)
		}
	}

	return {
		issuers,
		currencies
	}
}