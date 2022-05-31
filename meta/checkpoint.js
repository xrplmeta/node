import log from '@mwni/log'
import { wait } from '@xrplkit/time'
import { XFL, sum, abs, gt } from '@xrplkit/xfl'
import { sort } from '@xrplkit/xfl/extras'
import { getCurrentIndex } from '../ledger/state.js'
import { storeMetas } from './metas.js'
import { storeMetrics as storeTokenMetrics } from './token/metrics.js'
import { storeBalance as storeTokenWhaleBalance } from './token/whales.js'


export async function create(ctx){
	let ledgerIndex = await getCurrentIndex({ ledger: ctx.ledger })

	log.info(`creating checkpoint at ledger #${ledgerIndex}`)

	await walkTokens(ctx)
	await walkBooks(ctx)
}

async function walkTokens(ctx){
	let counter = 0
	let tokens = await ctx.ledger.trustlines.readMany({
		distinct: ['currency', 'issuer'],
		include: {
			issuer: true,
			account: true
		}
	})
	
	log.info(`got`, tokens.length, `tokens to walk through`)

	for(let token of tokens){
		await extractIssuerMeta({ ...ctx, issuer: token.issuer })
		await calculateTokenStats({ ...ctx, token })
		await wait(1)

		log.accumulate.info({
			line: [
				`processed`,
				++counter,
				`of`,
				tokens.length,
				`tokens (+%tokens in %time)`
			],
			tokens: 1
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

async function calculateTokenStats({ token, config, meta, ledger }){
	let { currency, issuer } = token
	let ledgerIndex = await getCurrentIndex({ ledger })
	let numTrustlines = 0
	let numHolders = 0
	let supply = XFL(0)
	let whales = []
	let maxWhales = config.ledger.tokens.captureWhales

	let trustlines = await ledger.trustlines.readMany({
		where: {
			currency: { code: currency.code },
			issuer: { address: issuer.address },
		},
		include: {
			holder: true
		}
	})

	for await(let { holder, balance } of trustlines){
		numTrustlines += 1
		numHolders += balance !== '0' ? 1 : 0
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

	if(numHolders === 0 && numTrustlines < config.ledger.tokens.ignoreBelowTrustlines){
		// delist token
		return
	}

	let tokenEntry = await meta.tokens.createOne({
		data: {
			currency: { code: currency.code },
			issuer: { address: issuer.address },
		}
	})

	await storeTokenMetrics({
		meta,
		token: tokenEntry,
		ledgerIndex,
		trustlines: numTrustlines,
		holders: numHolders,
		supply
	})

	for(let whale of whales){
		await storeTokenWhaleBalance({
			meta,
			token: tokenEntry,
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