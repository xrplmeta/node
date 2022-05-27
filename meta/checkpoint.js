import log from '@mwni/log'
import { wait } from '@xrplkit/time'
import { XFL, sum, abs, gt } from '@xrplkit/xfl'
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

		let partIssuedCurrencies = await ledger.rippleStates.readMany({
			select: ['currency', accountKey],
			distinct: ['currency', accountKey],
			where: {
				[issuerKey]: true,
			},
		})

		for await(let row of partIssuedCurrencies){
			let currencyId = row.currency.id
			let issuerId = row[accountKey].id
				
			if(issuedCurrencies.some(ic => ic.currencyId === currencyId || ic.issuerId === issuerId))
				continue

			issuedCurrencies.push({ currencyId, issuerId })
		}
	}
	
	log.info(`got`, issuedCurrencies.length, `issued currencies to walk through`)

	for(let { currencyId, issuerId } of issuedCurrencies){
		await processIssuedCurrency({ 
			issuedCurrency: {
				currency: await ledger.currencies.readOne({
					where: { id: currencyId }
				}),
				issuer: await ledger.accounts.readOne({
					where: { id: issuerId }
				})
			}, 
			config, 
			meta, 
			ledger 
		})

		await wait(1)

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
	let maxWhales = config.ledger.tokens.captureWhales

	let rippleStates = await ledger.rippleStates.readMany({
		where: {
			OR: [
				{
					currency: { code: currency.code },
					lowAccount: { address: issuer.address },
					lowIssuer: true
				},
				{
					currency: { code: currency.code },
					highAccount: { address: issuer.address },
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
		let account = rippleState.lowAccount.address === issuer.address
			? rippleState.highAccount
			: rippleState.lowAccount

		trustlines += 1
		holders += rippleState.balance !== '0' ? 1 : 0
		supply = sum(supply, balance)

		
		let insertWhaleAt = -1

		while(insertWhaleAt < whales.length - 1){
			if(gt(whales[insertWhaleAt + 1].balance, balance))
				break

			insertWhaleAt++
		}

		if(insertWhaleAt !== -1){
			whales = [
				...whales.slice(whales.length >= maxWhales ? 1 : 0, insertWhaleAt),
				{ account, balance },
				...whales.slice(insertWhaleAt)
			]
		}
	}

	if(holders === 0 && trustlines < config.ledger.tokens.ignoreBelowTrustlines){
		// delist token
		return
	}

	let token = await meta.tokens.createOne({
		data: {
			currency: { code: currency.code },
			issuer: { address: issuer.address },
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