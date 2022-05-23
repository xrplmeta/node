import log from '@mwni/log'
import { XFL, sum, abs } from '@xrplkit/xfl'
import { sort } from '@xrplkit/xfl/extras'


export async function create({ config, meta, ledger }){
	let state = await ledger.getState()

	log.info(`creating checkpoint at ledger #${state.ledgerIndex}`)

	let issuedCurrencies = []

	for(let side of ['low', 'high']){
		let accountKey = `${side}Account`
		let issuerKey = `${side}Issuer`

		let partIssuedCurrencies = await ledger.rippleStates.readMany({
			include: {
				currency: true,
				[accountKey]: true,
			},
			where: {
				[issuerKey]: true,
			},
			distinct: ['currency', accountKey]
		})

		for(let row of partIssuedCurrencies){
			let currency = row.currency.code
			let issuer = row[accountKey].address

			if(issuedCurrencies.some(ic => ic.currency === currency || ic.issuer === issuer))
				continue

			issuedCurrencies.push({ currency, issuer })
		}
	}
	
	log.info(`got`, issuedCurrencies.length, `issued currencies to walk through`)

	for(let issuedCurrency of issuedCurrencies){
		await processIssuedCurrency({ issuedCurrency, config, meta, ledger })
	}
}


async function processIssuedCurrency({ issuedCurrency, config, meta, ledger }){
	let { currency, issuer } = issuedCurrency
	let trustlines = 0
	let holders = 0
	let supply = XFL(0)
	let whales = []

	let rippleStates = await ledger.rippleStates.iter({
		where: {
			OR: [
				{
					currency: { code: currency },
					lowAccount: { address: issuer },
					lowIssuer: true
				},
				{
					currency: { code: currency },
					highAccount: { address: issuer },
					highIssuer: true
				}
			]
		},
		include: {
			lowAccount: true,
			highAccount: true
		}
	})

	for await(let rippleState of rippleStates){
		let balance = abs(rippleState.balance)
		let account = rippleState.lowAccount.address === issuer
			? rippleState.highAccount
			: rippleState.lowAccount

		trustlines += 1
		holders += rippleState.balance !== '0' ? 1 : 0
		supply = sum(supply, balance)

		whales = [ ...whales, { account, balance } ]
		whales = sort(whales, 'balance')
			.slice(0, config.ledger.tokens.captureWhales)
	}

	if(holders === 0 && trustlines < config.ledger.tokens.ignoreBelowTrustlines){
		// delist token
		return
	}

	let token = await meta.tokens.createOne({
		data: {
			currency: { code: currency },
			issuer: { address: issuer },
		}
	})

	console.log(token)
}