import { expect } from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createContext } from '../../env.js'
import { applyLedgerStateFromTransactions } from '../../../../src/ledger/state/index.js'
import { applyLedgerEvents } from '../../../../src/ledger/events/index.js'
import { updateDerived } from '../../../../src/ledger/derived/index.js'
import { readBalance } from '../../../../src/db/helpers/balances.js'
import { readTokenMetrics } from '../../../../src/db/helpers/tokenmetrics.js'
import { readTableHeads, pullNewItems } from '../../../../src/db/helpers/heads.js'
import TokenType from '../../../../src/xrpl/tokentype.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadScenario(name) {
	let scenario = JSON.parse(
		fs.readFileSync(path.join(__dirname, 'scenarios', `${name}.json`), 'utf-8')
	)

	for (let ledger of scenario.ledgers) {
		ledger.hash = ledger.ledger_hash
		ledger.closeTime = ledger.close_time

		for (let tx of ledger.transactions) {
			if (tx.tx_json) {
				Object.assign(tx, tx.tx_json)
			}
		}
	}

	return scenario
}

function resolveToken(ctx, tokenSpec) {
	if (tokenSpec.mptIssuanceId) {
		return ctx.db.core.tokens.readOne({
			where: {
				mptIssuanceId: tokenSpec.mptIssuanceId,
				tokenType: TokenType.MPT
			}
		})
	}

	return ctx.db.core.tokens.readOne({
		where: {
			currency: tokenSpec.currency,
			issuer: { address: tokenSpec.issuer }
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

function assertTokenMatch(actual, expected, label) {
	if (expected.mptIssuanceId) {
		expect(actual.mptIssuanceId, `${label}.mptIssuanceId`).to.equal(expected.mptIssuanceId)
		expect(actual.tokenType, `${label}.tokenType`).to.equal('MPT')
	} else if (expected.currency === 'XRP') {
		expect(actual.currency, `${label}.currency`).to.equal('XRP')
		expect(actual.tokenType, `${label}.tokenType`).to.equal('XRP')
	} else {
		expect(actual.currency, `${label}.currency`).to.equal(expected.currency)
		expect(actual.issuer?.address, `${label}.issuer`).to.equal(expected.issuer)
		expect(actual.tokenType, `${label}.tokenType`).to.equal('IOU')
	}
}

async function runAndAssert(scenarioName) {
	let ctx = await createContext()
	ctx.config.ledger = { captureOffers: false }

	let scenario = loadScenario(scenarioName)
	runScenario(ctx, scenario)

	let lastSequence = parseInt(scenario.ledgers[scenario.ledgers.length - 1].ledger_index)
	let expected = scenario.expected

	if (expected.token) {
		let token = resolveToken(ctx, expected.token)
		expect(token, 'token should exist').to.not.be.null

		let metricsToCheck = {}
		if (expected.metrics.holders !== undefined) metricsToCheck.holders = true
		if (expected.metrics.supply !== undefined) metricsToCheck.supply = true
		if (expected.metrics.trustlines !== undefined) metricsToCheck.trustlines = true
		if (expected.metrics.marketcap !== undefined) metricsToCheck.marketcap = true

		let metrics = readTokenMetrics({
			ctx,
			token,
			metrics: metricsToCheck,
			ledgerSequence: lastSequence,
		})

		if (expected.metrics.holders !== undefined)
			expect(metrics.holders || 0, 'holders').to.equal(expected.metrics.holders)

		if (expected.metrics.supply !== undefined)
			expect((metrics.supply || '0').toString(), 'supply').to.equal(expected.metrics.supply)

		if (expected.metrics.trustlines !== undefined)
			expect(metrics.trustlines || 0, 'trustlines').to.equal(expected.metrics.trustlines)

		if (expected.metrics.marketcap !== undefined)
			expect((metrics.marketcap || '0').toString(), 'marketcap').to.equal(expected.metrics.marketcap)

		if (expected.balances) {
			for (let { account, value } of expected.balances) {
				let balance = readBalance({
					ctx,
					account: { address: account },
					token,
					ledgerSequence: lastSequence,
				})
				expect((balance || '0').toString(), `balance of ${account}`).to.equal(value)
			}
		}
	}

	let exchanges = ctx.db.core.tokenExchanges.readMany({
		include: {
			takerPaidToken: { issuer: true },
			takerGotToken: { issuer: true },
			taker: true,
			maker: true,
		}
	})

	expect(exchanges.length, 'exchange count').to.equal(expected.exchanges.length)

	for (let i = 0; i < expected.exchanges.length; i++) {
		let actual = exchanges[i]
		let exp = expected.exchanges[i]

		expect(actual.taker.address, `exchange[${i}].taker`).to.equal(exp.taker)
		expect(actual.maker.address, `exchange[${i}].maker`).to.equal(exp.maker)

		assertTokenMatch(actual.takerPaidToken, exp.takerPaidToken, `exchange[${i}].takerPaidToken`)
		assertTokenMatch(actual.takerGotToken, exp.takerGotToken, `exchange[${i}].takerGotToken`)

		if (exp.takerPaidValue !== undefined)
			expect(actual.takerPaidValue.toString(), `exchange[${i}].takerPaidValue`).to.equal(exp.takerPaidValue)

		if (exp.takerGotValue !== undefined)
			expect(actual.takerGotValue.toString(), `exchange[${i}].takerGotValue`).to.equal(exp.takerGotValue)
	}
}


// ─── Exact Offer Match ───

describe('Exact Offer Match', () => {
	it('IOU/XRP: Alice sells 500 USD for 10 XRP, Bob crosses', async () => {
		await runAndAssert('iou-xrp-offer')
	})

	it('IOU/IOU: Alice sells 100 USD for 200 EUR, Bob crosses (no XRP pair, marketcap=0)', async () => {
		await runAndAssert('iou-iou-offer')
	})

	it('IOU/MPT: Alice sells 100 USD for 5000 MPT (AssetScale=3), Bob crosses (no XRP pair, marketcap=0)', async () => {
		await runAndAssert('iou-mpt-offer')
	})

	it('MPT/XRP: Alice sells 500 MPT (AssetScale=2) for 50 XRP, Bob crosses (price=10, marketcap=100)', async () => {
		await runAndAssert('mpt-xrp-offer')
	})

	it('MPT/MPT: Alice sells 500 MPT-A (scale=2) for 20000 MPT-B (scale=4), Bob crosses (no XRP pair, marketcap=0)', async () => {
		await runAndAssert('mpt-mpt-offer')
	})

	it('MPT/XRP multi: Alice and Bob each sell 50 MPT for 25 XRP, Charlie crosses both (2 exchanges, price=50, marketcap=1000)', async () => {
		await runAndAssert('mpt-xrp-multi-offer')
	})
})


// ─── AMM Offer Consumption ───

describe('AMM Offer Consumption', () => {
	it('IOU/XRP AMM: Alice creates 500 USD + 100 XRP pool, Bob offer crosses AMM', async () => {
		await runAndAssert('iou-xrp-amm-offer')
	})

	it('MPT/XRP AMM: Alice creates 500000 MPT (scale=2) + 100 XRP pool, Bob offer crosses AMM', async () => {
		await runAndAssert('mpt-xrp-amm-offer')
	})
})


// ─── Combined Offer + AMM Consumption ───

describe('Combined Offer + AMM Consumption', () => {
	it('MPT/XRP: Alice offer + Bob AMM pool, Charlie crosses both (2 exchanges: 1 offer + 1 AMM)', async () => {
		await runAndAssert('mpt-xrp-offer-plus-amm')
	})
})


// ─── AMM Non-Consumption (offer sits on book, 0 exchanges) ───

describe('AMM Non-Consumption', () => {
	it('IOU/IOU AMM: Alice creates 500 USD + 500 EUR pool, Bob offer does NOT cross', async () => {
		await runAndAssert('iou-iou-amm-offer')
	})

	it('IOU/MPT AMM: Alice creates 500 USD + 500000 MPT (scale=2) pool, Bob offer does NOT cross', async () => {
		await runAndAssert('iou-mpt-amm-offer')
	})

	it('MPT/MPT AMM: Alice creates 500000 MPT-A (scale=2) + 100000 MPT-B (scale=4) pool, Bob offer does NOT cross', async () => {
		await runAndAssert('mpt-mpt-amm-offer')
	})
})
