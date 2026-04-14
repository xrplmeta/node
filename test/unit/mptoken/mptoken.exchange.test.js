import { expect } from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createContext } from '../env.js'
import { applyLedgerStateFromTransactions } from '../../../src/ledger/state/index.js'
import { applyLedgerEvents } from '../../../src/ledger/events/index.js'
import { updateDerived } from '../../../src/ledger/derived/index.js'
import { readBalance } from '../../../src/db/helpers/balances.js'
import { readTokenMetrics } from '../../../src/db/helpers/tokenmetrics.js'
import { readTableHeads, pullNewItems } from '../../../src/db/helpers/heads.js'
import TokenType from '../../../src/xrpl/tokentype.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadScenario(type, name) {
	let scenario = JSON.parse(
		fs.readFileSync(path.join(__dirname, 'scenarios', type, `${name}.json`), 'utf-8')
	)

	for (let ledger of scenario.ledgers) {
		ledger.hash = ledger.ledger_hash
		ledger.closeTime = ledger.close_time

		for (let tx of ledger.transactions) {
			// Flatten tx_json fields to top level for API v2 format
			if (tx.tx_json) {
				Object.assign(tx, tx.tx_json)
			}
		}
	}

	return scenario
}

function resolveToken(ctx, mptIssuanceId) {
	return ctx.db.core.tokens.readOne({
		where: {
			mptIssuanceId,
			tokenType: TokenType.MPT
		}
	})
}

function runScenario(ctx, scenario) {
	for (let rawLedger of scenario.ledgers) {
		let ledger = { ...rawLedger, sequence: parseInt(rawLedger.ledger_index) }
		let testCtx = { ...ctx, ledgerSequence: ledger.sequence }

		ctx.db.core.tx(() => {
			let heads = readTableHeads({ ctx: testCtx })

			applyLedgerStateFromTransactions({ ctx: testCtx, ledger })
			applyLedgerEvents({ ctx: testCtx, ledger })
			updateDerived({
				ctx: testCtx,
				newItems: pullNewItems({
					ctx: testCtx,
					previousHeads: heads
				})
			})
		})
	}
}

function assertScenario(ctx, scenario) {
	let lastSequence = parseInt(scenario.ledgers[scenario.ledgers.length - 1].ledger_index)
	let token = resolveToken(ctx, scenario.mptIssuanceId)

	// Assert balances
	for (let { account, value } of scenario.expected.balances) {
		let balance = readBalance({
			ctx,
			account: { address: account },
			token,
			ledgerSequence: lastSequence,
		})

		expect(
			(balance || '0').toString(),
			`balance of ${account}`
		).to.equal(value)
	}

	// Assert metrics
	let metricsToCheck = { holders: true, supply: true }
	if (scenario.expected.metrics.marketcap !== undefined) {
		metricsToCheck.marketcap = true
	}

	let metrics = readTokenMetrics({
		ctx,
		token,
		metrics: metricsToCheck,
		ledgerSequence: lastSequence,
	})

	expect(
		metrics.holders || 0,
		'holders count'
	).to.equal(scenario.expected.metrics.holders)

	expect(
		(metrics.supply || '0').toString(),
		'supply'
	).to.equal(scenario.expected.metrics.supply)

	if (scenario.expected.metrics.marketcap !== undefined) {
		expect(
			(metrics.marketcap || '0').toString(),
			'marketcap'
		).to.equal(scenario.expected.metrics.marketcap)
	}

	// Assert exchange records
	let exchanges = ctx.db.core.tokenExchanges.readMany({
		include: {
			takerPaidToken: { issuer: true },
			takerGotToken: { issuer: true },
			taker: true,
			maker: true,
		}
	})

	expect(exchanges.length, 'exchange count').to.equal(scenario.expected.exchange.count)

	let exchange = exchanges[0]
	expect(exchange.takerPaidToken.tokenType, 'takerPaidToken type').to.equal(scenario.expected.exchange.takerPaidTokenType)
	expect(exchange.takerGotToken.tokenType, 'takerGotToken type').to.equal(scenario.expected.exchange.takerGotTokenType)
	expect(exchange.takerPaidValue.toString(), 'takerPaidValue').to.equal(scenario.expected.exchange.takerPaidValue)
	expect(exchange.takerGotValue.toString(), 'takerGotValue').to.equal(scenario.expected.exchange.takerGotValue)
	expect(exchange.taker.address, 'taker').to.equal(scenario.expected.exchange.taker)
	expect(exchange.maker.address, 'maker').to.equal(scenario.expected.exchange.maker)
}


describe('MPToken exchange - MPT/XRP offer', () => {
	let ctx
	let scenario = loadScenario('sync', 'mpt-xrp-offer')

	before(async () => {
		ctx = await createContext()
		ctx.config.ledger = { captureOffers: false }
	})

	it(scenario.description, () => {
		runScenario(ctx, scenario)
		assertScenario(ctx, scenario)
	})
})

describe('MPToken exchange - MPT/IOU offer', () => {
	let ctx
	let scenario = loadScenario('sync', 'mpt-iou-offer')

	before(async () => {
		ctx = await createContext()
		ctx.config.ledger = { captureOffers: false }
	})

	it(scenario.description, () => {
		runScenario(ctx, scenario)
		assertScenario(ctx, scenario)
	})
})
