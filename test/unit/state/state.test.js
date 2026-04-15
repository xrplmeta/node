import { expect } from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createContext } from '../env.js'
import { applyLedgerStateFromTransactions, applyLedgerStateFromObjects } from '../../../src/ledger/state/index.js'
import { readBalance } from '../../../src/db/helpers/balances.js'
import { readTokenMetrics } from '../../../src/db/helpers/tokenmetrics.js'
import TokenType from '../../../src/xrpl/tokentype.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadScenario(name) {
	return JSON.parse(
		fs.readFileSync(path.join(__dirname, 'fixtures', `${name}.json`), 'utf-8')
	)
}

function resolveToken(ctx, mptIssuanceId) {
	return ctx.db.core.tokens.readOne({
		where: {
			mptIssuanceId,
			tokenType: TokenType.MPT
		}
	})
}

function assertExpected(ctx, mptIssuanceId, expected, ledgerSequence) {
	let token = resolveToken(ctx, mptIssuanceId)

	for (let { account, value } of expected.balances) {
		let balance = readBalance({
			ctx,
			account: { address: account },
			token,
			ledgerSequence,
		})

		expect(
			(balance || '0').toString(),
			`balance of ${account}`
		).to.equal(value)
	}

	let metrics = readTokenMetrics({
		ctx,
		token,
		metrics: { holders: true, supply: true },
		ledgerSequence,
	})

	expect(
		metrics.holders || 0,
		'holders count'
	).to.equal(expected.metrics.holders)

	expect(
		(metrics.supply || '0').toString(),
		'supply'
	).to.equal(expected.metrics.supply)
}


// /////////////////////////////////////////////////////////////////////
// Sync (forward) tests
// /////////////////////////////////////////////////////////////////////

describe('MPToken state - sync (forward)', () => {
	let ctx
	let scenario = loadScenario('supply-holders-transfer-fee')

	before(async () => {
		ctx = await createContext()
	})

	it(scenario.description, () => {
		for (let rawLedger of scenario.ledgers) {
			let ledger = { ...rawLedger, sequence: parseInt(rawLedger.ledger_index) }
			let testCtx = { ...ctx, ledgerSequence: ledger.sequence }

			ctx.db.core.tx(() => {
				applyLedgerStateFromTransactions({ ctx: testCtx, ledger })
			})
		}

		let lastSequence = parseInt(scenario.ledgers[scenario.ledgers.length - 1].ledger_index)
		assertExpected(ctx, scenario.mptIssuanceId, scenario.expected, lastSequence)
	})
})
