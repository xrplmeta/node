import { expect } from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createContext } from '../env.js'
import { applyLedgerStateFromTransactions, applyLedgerStateFromObjects } from '../../../src/ledger/state/index.js'
import { createMPTokenIssuancesFromTransactions, createMissingMPTokenIssuanceFromObjects } from '../../../src/xrpl/mpt.js'
import { readBalance } from '../../../src/db/helpers/balances.js'
import { readTokenMetrics } from '../../../src/db/helpers/tokenmetrics.js'
import TokenType from '../../../src/xrpl/tokentype.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadFixture(name) {
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
	expect(token, 'token should exist').to.not.be.null

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


describe('MPToken state - sync (forward)', () => {
	it('MPT transfers: Issuer->Alice->Bob->Charlie->Issuer with AssetScale=2', async () => {
		let ctx = await createContext()
		let fixture = loadFixture('mpt-transfers')

		for (let rawLedger of fixture.ledgers) {
			let ledger = { ...rawLedger, sequence: parseInt(rawLedger.ledger_index) }
			let testCtx = { ...ctx, ledgerSequence: ledger.sequence }

			ctx.db.core.tx(() => {
				createMPTokenIssuancesFromTransactions({ ctx: testCtx, ledger })
				applyLedgerStateFromTransactions({ ctx: testCtx, ledger })
			})
		}

		let lastSequence = parseInt(fixture.ledgers[fixture.ledgers.length - 1].ledger_index)
		assertExpected(ctx, fixture.mptIssuanceId, fixture.expected, lastSequence)
	})
})


describe('MPToken state - snapshot', () => {
	it('MPT transfers: same expected state from ledger objects', async () => {
		let ctx = await createContext()
		let fixture = loadFixture('mpt-transfers')

		let snapshotCtxWithXrpl = {
			...ctx,
			xrpl: {
				request: async () => { throw new Error('mock: ledger_entry not available in test') }
			}
		}

		await createMissingMPTokenIssuanceFromObjects({
			ctx: snapshotCtxWithXrpl,
			objects: fixture.snapshotObjects,
			ledgerSequence: fixture.snapshotSequence
		})

		// Apply all ledger objects (MPTokenIssuance + MPToken)
		// In real snapshot, ctx.ledgerSequence is 0
		let snapshotCtx = { ...ctx, ledgerSequence: 0 }

		ctx.db.core.tx(() => {
			applyLedgerStateFromObjects({
				ctx: snapshotCtx,
				objects: fixture.snapshotObjects
			})
		})

		assertExpected(ctx, fixture.mptIssuanceId, fixture.expected, fixture.snapshotSequence)
	})
})
