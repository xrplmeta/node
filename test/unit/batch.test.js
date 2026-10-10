import { expect } from 'chai'
import { createContext, readLedgerTxTypeCounts } from './env.js'
import { format, formatTransactions, annotateBatch, isInnerBatchTransaction, tfInnerBatchTxn } from '../../src/xrpl/ledger.js'
import { applyLedgerStats } from '../../src/ledger/events/ledgers.js'

const OUTER_HASH = 'AA'.repeat(32)
const INNER_HASH = 'BB'.repeat(32)

function outerBatchTx(){
	return {
		TransactionType: 'Batch',
		Account: 'rUserBSM7T3b6nHX3Jjua62wgX9unH8s9b',
		Fee: '40',
		Flags: 0x00010000,
		RawTransactions: [
			{ RawTransaction: { TransactionType: 'Payment', Fee: '0', Flags: tfInnerBatchTxn } }
		],
		hash: OUTER_HASH,
		metaData: { AffectedNodes: [], TransactionIndex: 0, TransactionResult: 'tesSUCCESS' }
	}
}

function innerTx(){
	return {
		TransactionType: 'Payment',
		Account: 'rUserBSM7T3b6nHX3Jjua62wgX9unH8s9b',
		Fee: '0',
		Flags: tfInnerBatchTxn,
		SigningPubKey: '',
		hash: INNER_HASH,
		metaData: { AffectedNodes: [], TransactionIndex: 1, TransactionResult: 'tesSUCCESS', ParentBatchID: OUTER_HASH }
	}
}

function regularTx(index, fee){
	return {
		TransactionType: 'OfferCreate',
		Account: 'rspYLR9rDNXRkZXzLtRxtnw852Thmdyizb',
		Fee: String(fee),
		Flags: 0,
		hash: ('C' + index).padEnd(64, '0'),
		metaData: { AffectedNodes: [], TransactionIndex: index, TransactionResult: 'tesSUCCESS' }
	}
}


describe('Batch Tx - transaction normalization', () => {
	it('annotates inner transactions with parentBatchHash', () => {
		let tx = annotateBatch(innerTx())
		expect(tx.parentBatchHash).to.equal(OUTER_HASH)
		expect(isInnerBatchTransaction(tx)).to.be.true
	})

	it('leaves outer Batch and regular transactions untouched', () => {
		expect(annotateBatch(outerBatchTx())).to.not.have.property('parentBatchHash')
		expect(annotateBatch(regularTx(2, 12))).to.not.have.property('parentBatchHash')
		expect(isInnerBatchTransaction(outerBatchTx())).to.be.false
		expect(isInnerBatchTransaction(regularTx(2, 12))).to.be.false
	})

	it('detects inner transactions by tfInnerBatchTxn flag as fallback', () => {
		let tx = { ...innerTx(), metaData: { AffectedNodes: [] } }
		expect(isInnerBatchTransaction(tx)).to.be.true
	})

	it('supports api v2 shape ({ tx_json, meta, hash })', () => {
		let { metaData, hash, ...tx_json } = innerTx()
		let [tx] = formatTransactions([{ tx_json, meta: metaData, hash }])
		expect(tx.hash).to.equal(INNER_HASH)
		expect(tx.metaData).to.deep.equal(metaData)
		expect(tx.parentBatchHash).to.equal(OUTER_HASH)
	})

	it('orders transactions by TransactionIndex (outer before inner)', () => {
		let ledger = format({
			ledger_index: '100',
			ledger_hash: 'DD'.repeat(32),
			close_time: 829582090,
			transactions: [regularTx(2, 12), innerTx(), outerBatchTx()]
		})

		expect(ledger.transactions.map(tx => tx.metaData.TransactionIndex)).to.deep.equal([0, 1, 2])
		expect(ledger.transactions[0].TransactionType).to.equal('Batch')
		expect(ledger.transactions[1].parentBatchHash).to.equal(OUTER_HASH)
	})
})


describe('Batch Tx - ledger stats', () => {
	it('counts inner transactions by type but excludes their inner zero fee', async () => {
		let ctx = await createContext()
		let ledger = {
			sequence: 100,
			hash: 'DD'.repeat(32),
			closeTime: 1700000000,
			transactions: formatTransactions([outerBatchTx(), innerTx(), regularTx(2, 20)])
		}

		ctx.db.core.tx(() => applyLedgerStats({ ctx, ledger }))

		let row = ctx.db.core.ledgers.readOne({
			where: { sequence: 100 }
		})

		expect(row.txCount).to.equal(3)
		expect(row.minFee).to.equal(20)
		expect(row.maxFee).to.equal(40)
		expect(row.avgFee).to.equal(30)

		let counts = readLedgerTxTypeCounts({ ctx, sequence: 100 })
		expect(counts).to.deep.equal({ Batch: 1, Payment: 1, OfferCreate: 1 })
	})

	it('does not produce fee stats when a ledger only contains pseudo transactions', async () => {
		let ctx = await createContext()
		let ledger = {
			sequence: 101,
			hash: 'EE'.repeat(32),
			closeTime: 1700000000,
			transactions: [{ TransactionType: 'SetFee', Fee: '0', hash: 'F'.repeat(64), metaData: { AffectedNodes: [], TransactionIndex: 0 } }]
		}

		ctx.db.core.tx(() => applyLedgerStats({ ctx, ledger }))

		let row = ctx.db.core.ledgers.readOne({ where: { sequence: 101 } })

		expect(row.txCount).to.equal(1)
		expect(row.minFee).to.be.oneOf([null, undefined])
		expect(row.maxFee).to.be.oneOf([null, undefined])
	})
})
