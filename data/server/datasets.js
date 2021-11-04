import { currencyHexToUTF8 } from '../../common/xrpl.js'


export async function currencies(repo){
	let trustlines = await repo.getTrustlines()
	let stats = await repo.getMostRecentHoldings(trustlines)
	let dataset = []


	for(let trustline of trustlines){
		let { currency, issuer } = trustline
		let humanCurrency = currencyHexToUTF8(currency)
		let stat = stats.find(s => s.trustline === trustline.id)
		let trustlines = stat ? stat.count : 0

		dataset.push({
			currency: humanCurrency, 
			issuer,
			trustlines
		})
	}

	dataset.sort((a, b) => b.trustlines - a.trustlines)

	return {dataset}
}
