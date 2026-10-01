import { expect } from 'chai'
import { createContext } from '../env.js'
import { applyLedgerStateFromObjects, applyLedgerStateFromTransactions } from '../../../src/ledger/state/index.js'
import { readTokenMetrics, readTokenMetricIntervalSeries } from '../../../src/db/helpers/tokenmetrics.js'

const issuer = 'rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE'
const alice = 'rMwNibdiFaEzsTaFCG1NnmAM3Rv3vHUy5L'
const bob = 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'
const charlie = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh'

function fields(account, balance, previousSequence){
	return {
		Balance: { currency: 'USD', value: balance === '0' ? '0' : `-${balance}` },
		LowLimit: { issuer, currency: 'USD', value: '0' },
		HighLimit: { issuer: account, currency: 'USD', value: '100' },
		PreviousTxnLgrSeq: previousSequence
	}
}

function created(account, balance){
	return { CreatedNode: { LedgerEntryType: 'RippleState', NewFields: fields(account, balance) } }
}

function modified(account, previousBalance, balance, previousSequence){
	return { ModifiedNode: {
		LedgerEntryType: 'RippleState',
		PreviousTxnLgrSeq: previousSequence,
		FinalFields: fields(account, balance, previousSequence),
		PreviousFields: { Balance: fields(account, previousBalance).Balance }
	} }
}

function apply(ctx, sequence, nodes, backwards = false){
	ctx.db.core.tx(() => applyLedgerStateFromTransactions({
		ctx: { ...ctx, ledgerSequence: sequence, backwards },
		ledger: { sequence, transactions: [{ meta: { AffectedNodes: nodes } }] }
	}))
}

function metricsAt(ctx, sequence){
	let metrics = readTokenMetrics({
		ctx,
		token: { currency: 'USD', issuer: { address: issuer } },
		ledgerSequence: sequence,
		metrics: { trustlines: true, holders: true, supply: true }
	})
	return [metrics.trustlines || 0, metrics.holders || 0, (metrics.supply || 0).toString()]
}

describe('IOU metric backfill', () => {
	it('accumulates reversed changes across ledgers and preserves historical boundaries and live totals', async () => {
		let ctx = await createContext()
		applyLedgerStateFromObjects({
			ctx: { ...ctx, ledgerSequence: 0 },
			objects: [
				{ LedgerEntryType: 'RippleState', ...fields(alice, '10', 15) },
				{ LedgerEntryType: 'RippleState', ...fields(bob, '4', 25) }
			]
		})
		// Live syncing can advance while the independent backfill runs.
		apply(ctx, 40, [created(charlie, '5')])
		expect(metricsAt(ctx, 40)).to.deep.equal([3, 3, '19'])

		let ledgers = [
			[5, [created(charlie, '7')]],
			[10, [created(alice, '2')]],
			[15, [modified(alice, '2', '10', 10)]],
			[20, [created(bob, '0')]],
			[25, [modified(bob, '0', '4', 20)]],
			[30, [{ DeletedNode: { LedgerEntryType: 'RippleState', FinalFields: fields(charlie, '7', 5) } }]]
		]
		for(let [sequence, nodes] of ledgers.reverse()){
			apply(ctx, sequence, nodes, true)
			expect(metricsAt(ctx, 40), `live totals after reversing ${sequence}`).to.deep.equal([3, 3, '19'])
		}

		let expected = [
			[0, [0, 0, '0']],
			[5, [1, 1, '7']],
			[10, [2, 2, '9']],
			[15, [2, 2, '17']],
			[20, [3, 2, '17']],
			[25, [3, 3, '21']],
			[30, [2, 2, '14']],
			[40, [3, 3, '19']]
		]
		for(let i = 1; i < expected.length; i++){
			let [sequence, metrics] = expected[i]
			expect(metricsAt(ctx, sequence), `at ledger ${sequence}`).to.deep.equal(metrics)
			expect(metricsAt(ctx, sequence - 1), `before ledger ${sequence}`).to.deep.equal(expected[i - 1][1])
		}

		let token = ctx.db.core.tokens.readOne({ where: { currency: 'USD', issuer: { address: issuer } } })
		let series = readTokenMetricIntervalSeries({
			ctx, token, metric: 'trustlines', sequence: { start: 5, end: 40, interval: 1 }
		})
		expect(series.map(({ sequence, value }) => [sequence, value])).to.deep.equal([
			[5, 1], [10, 2], [20, 3], [30, 2], [40, 3]
		])
	})

	it('reverses a modification that removes an issuer side from a trustline', async () => {
		let ctx = await createContext()
		let node = modified(alice, '0', '0', 5)
		node.ModifiedNode.FinalFields.HighLimit.value = '0'
		node.ModifiedNode.PreviousFields.HighLimit = { issuer: alice, currency: 'USD', value: '100' }
		apply(ctx, 10, [node], true)
		expect(metricsAt(ctx, 9)).to.deep.equal([1, 0, '0'])
		expect(metricsAt(ctx, 10)).to.deep.equal([0, 0, '0'])
		apply(ctx, 5, [created(alice, '0')], true)
		expect(metricsAt(ctx, 4)).to.deep.equal([0, 0, '0'])
		expect(metricsAt(ctx, 5)).to.deep.equal([1, 0, '0'])
	})
})
