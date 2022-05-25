import log from '@mwni/log'
import { XFL, sum, abs } from '@xrplkit/xfl'
import { sort } from '@xrplkit/xfl/extras'
import { getCurrentIndex } from '../ledger/state.js'
import { storeTokenMetricPoint } from './metrics.js'


export async function create({ config, meta, ledger }){
	log.info(`creating checkpoint at ledger #${await getCurrentIndex({ ledger })}`)

	let issuedCurrencies = []
	let counter = 0

	for(let side of ['low', 'high']){
		let accountKey = `${side}Account`
		let issuerKey = `${side}Issuer`

		let partIssuedCurrencies = await ledger.rippleStates.iter({
			include: {
				currency: true,
				[accountKey]: true,
			},
			where: {
				[issuerKey]: true,
			},
			distinct: ['currency', accountKey]
		})

		for await(let row of partIssuedCurrencies){
			let currency = row.currency.code
			let issuer = row[accountKey].address

			if(issuedCurrencies.some(ic => ic.currency === currency || ic.issuer === issuer))
				continue

			issuedCurrencies.push({ currency, issuer })

			if(Math.random() > 0.95)
				console.log(issuedCurrencies.length)
		}
	}
	
	log.info(`got`, issuedCurrencies.length, `issued currencies to walk through`)

	for(let issuedCurrency of issuedCurrencies){
		await processIssuedCurrency({ issuedCurrency, config, meta, ledger })

		log.accumulate.info({
			line: [
				`processed`,
				counter++,
				`of`,
				issuedCurrencies.length,
				`issued currencies (+%issuedCurrencies in %time)`
			],
			issuedCurrencies: 1
		})
	}

	log.flush()
}


async function processIssuedCurrency({ issuedCurrency, config, meta, ledger }){
	let { currency, issuer } = issuedCurrency
	let ledgerIndex = await getCurrentIndex({ ledger })
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

	await storeTokenMetricPoint({
		meta,
		token,
		ledgerIndex,
		trustlines,
		holders,
		supply
	})
}