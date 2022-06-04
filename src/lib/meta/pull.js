import log from '@mwni/log'
import { wait } from '@xrplkit/time'
import { sum, gt, toString } from '@xrplkit/xfl/native'
import { storeMetas } from './props.js'
import { read as readTokenMetrics, write as writeTokenMetrics } from './token/metrics.js'
import { storeBalance as storeTokenWhaleBalance } from './token/whales.js'


export async function pull({ state, ...ctx }){
	let { ledgerIndex } = await state.journal.readOne({ last: true })

	await walkTokens({ ...ctx, state, ledgerIndex })
	//await walkBooks(ctx)
}

async function walkTokens({ state, ledgerIndex, ...ctx }){
	let tokens = await state.trustlines.iter({
		distinct: ['currency', 'issuer'],
		include: {
			currency: true,
			issuer: true,
			account: true
		},
		where: {
			NOT: {
				change: null
			}
		}
	})

	for await(let token of tokens){
		//await extractIssuerMeta({ ...ctx, issuer: token.issuer })
		await updateTokenMetrics({ ...ctx, token, state, ledgerIndex })
		await wait(1)

		log.accumulate.info({
			line: [`pulled +%pulledTokens in %time`],
			pulledTokens: 1
		})
	}

	log.flush()
}

async function extractIssuerMeta({ issuer, config, meta, ledger }){
	await storeMetas({
		meta,
		metas: {
			emailHash: issuer.emailHash,
			domain: issuer.domain
			? Buffer.from(issuer.domain, 'hex').toString()
			: undefined
		},
		issuer
	})
}

async function updateTokenMetrics({ token, meta, state, ledgerIndex, config }){
	let { currency, issuer } = token
	let maxWhales = config.ledger.tokens.captureWhales
	let ignoreBelowTrustlines = config.ledger.tokens.ignoreBelowTrustlines

	let metrics = {
		trustlines: await state.trustlines.count({
			where: {
				currency: { 
					code: currency.code 
				},
				issuer: { 
					address: issuer.address 
				},
			}
		}),
		holders: await state.trustlines.count({
			where: {
				currency: { 
					code: currency.code 
				},
				issuer: { 
					address: issuer.address 
				},
				NOT: {
					balance: 0
				}
			}
		}),
		supply: 0,
		...await readTokenMetrics({ 
			meta,
			ledgerIndex,
			supply: true
		})
	}

	if(metrics.holders === 0 && metrics.trustlines < ignoreBelowTrustlines){
		await meta.tokens.delete({
			where: {
				currency: { code: currency.code },
				issuer: { address: issuer.address },
			}
		})
		return
	}

	let whales = []

	let trustlines = await state.trustlines.iter({
		where: {
			NOT: {
				change: null
			},
			currency: { 
				code: currency.code 
			},
			issuer: { 
				address: issuer.address 
			},
		},
		include: {
			holder: true
		}
	})

	for await(let { holder, balance } of trustlines){
		metrics.supply = sum(metrics.supply, balance)
		
		/*let insertWhaleAt = -1

		while(insertWhaleAt < whales.length){
			let whale = whales[insertWhaleAt + 1]

			if(whale && gt(whale.balance, balance))
				break

			insertWhaleAt++
		}

		if(insertWhaleAt !== -1){
			whales = [
				...whales.slice(whales.length >= maxWhales ? 1 : 0, insertWhaleAt),
				{ account: holder, balance },
				...whales.slice(insertWhaleAt)
			]
		}*/
	}


	let { id } = await meta.tokens.createOne({
		data: {
			currency: { code: currency.code },
			issuer: { address: issuer.address },
		}
	})

	await writeTokenMetrics({
		meta,
		token: { id },
		ledgerIndex,
		...metrics
	})

	for(let whale of whales){
		await storeTokenWhaleBalance({
			meta,
			token: { id },
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

	log.info(`got`, totalCount, `currency offers to walk through`)
	
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