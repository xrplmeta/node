import log from '@mwni/log'
import { wait } from '@xrplkit/time'
import { XFL, sum, abs, gt } from '@xrplkit/xfl'
import { sort } from '@xrplkit/xfl/extras'
import { getCurrentIndex } from '../ledger/state.js'
import { storeMetricPoint as storeTokenMetricPoint } from './token/metrics.js'
import { storeWhaleBalance as storeTokenWhaleBalance } from './token/whales.js'


export async function create({ config, meta, ledger }){
	log.info(`creating checkpoint at ledger #${await getCurrentIndex({ ledger })}`)

	//let issuedCurrencies = await discoverIssuedCurrencies({ ledger })
	
	//log.info(`got`, issuedCurrencies.length, `issued currencies to walk through`)
	
	//await proccessIssuedCurrencies({ config, meta, ledger, issuedCurrencies })
	await walkBooks({ config, meta, ledger })
}

async function discoverIssuedCurrencies({ ledger }){
	let issuedCurrencies = []

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

	return issuedCurrencies
}

async function proccessIssuedCurrencies({ config, meta, ledger, issuedCurrencies }){
	let counter = 0

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
				++counter,
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

		while(insertWhaleAt < whales.length){
			let whale = whales[insertWhaleAt + 1]

			if(whale && gt(whale.balance, balance))
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

	for(let whale of whales){
		await storeTokenWhaleBalance({
			meta,
			token,
			ledgerIndex,
			...whale
		})
	}
}


async function walkBooks({ config, meta, ledger }){
	let ledgerIndex = await getCurrentIndex({ ledger })
	let counter = 0
	let totalCount = await ledger.currencyOffers.count()
	let offers = await ledger.currencyOffers.iter({
		include: {
			account: true,
			takerPaysCurrency: true,
			takerPaysIssuer: true,
			takerGetsCurrency: true,
			takerGetsIssuer: true
		}
	})
	
	
	for await(let offer of offers){
		let takerPaysToken
		let takerGetsToken

		if(offer.takerPaysIssuer){
			takerPaysToken = {
				currency: {
					code: offer.takerPaysCurrency.code
				},
				issuer: {
					address: offer.takerPaysIssuer.address
				}
			}
		}

		if(offer.takerGetsIssuer){
			takerGetsToken = {
				currency: {
					code: offer.takerGetsCurrency.code
				},
				issuer: {
					address: offer.takerGetsIssuer.address
				}
			}
		}

		await meta.tokenBookOffers.createOne({
			data: {
				book: {
					takerPaysToken,
					takerGetsToken
				},
				account: {
					address: offer.account.address
				},
				sequence: offer.sequence,
				takerPaysValue: offer.takerPaysValue,
				takerGetsValue: offer.takerGetsValue,
				startLedgerIndex: ledgerIndex
			}
		})

		await wait(1)

		log.accumulate.info({
			line: [
				`processed`,
				++counter,
				`of`,
				totalCount,
				`currency offers (+%currencyOffers in %time)`
			],
			currencyOffers: 1
		})
	}
}