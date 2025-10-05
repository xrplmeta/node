import { expect } from 'chai'
import { createContext } from './env.js'
import { readPoint, writePoint } from '../../src/db/helpers/common.js'


const ctx = await createContext()
const account = { address: 'rMwNibdiFaEzsTaFCG1NnmAM3Rv3vHUy5L' }
const token = {
	currency: 'RLUSD', 
	issuer: { address: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De' }
}
const book = {
	takerPays: token,
	takerGets: { currency: 'XRP', issuer: null }
}


describe(
	'Database Points',
	() => {
		it(
			'it should create first non-expirable point at sequence 100',
			() => {
				writePoint({
					table: ctx.db.core.accountBalances,
					selector: { account, token },
					ledgerSequence: 100,
					backwards: false,
					data: { balance: '10' },
					expirable: false
				})
			}
		)

		it(
			'it should read latest and exact sequence for first point',
			() => {
				let pLatest = readPoint({
					table: ctx.db.core.accountBalances,
					selector: { account, token },
				})
				expect(pLatest.balance.toString()).to.equal('10')

				let p100 = readPoint({
					table: ctx.db.core.accountBalances,
					selector: { account, token },
					ledgerSequence: 100
				})
				expect(p100.balance.toString()).to.equal('10')
			}
		)

		it(
			'it should be idempotent when writing same data at same sequence',
			() => {
				writePoint({
					table: ctx.db.core.accountBalances,
					selector: { account, token },
					ledgerSequence: 100,
					backwards: false,
					data: { balance: '10' },
					expirable: false
				})
				let p100Same = readPoint({
					table: ctx.db.core.accountBalances,
					selector: { account, token },
					ledgerSequence: 100
				})
				expect(p100Same.balance.toString()).to.equal('10')
			}
		)

		it(
			'it should overwrite data at the same sequence',
			() => {
				writePoint({
					table: ctx.db.core.accountBalances,
					selector: { account, token },
					ledgerSequence: 100,
					backwards: false,
					data: { balance: '15' },
					expirable: false
				})
				let p100Updated = readPoint({
					table: ctx.db.core.accountBalances,
					selector: { account, token },
					ledgerSequence: 100
				})
				expect(p100Updated.balance.toString()).to.equal('15')
			}
		)

		it(
			'it should add later point at 105 and step reads accordingly',
			() => {
				writePoint({
					table: ctx.db.core.accountBalances,
					selector: { account, token },
					ledgerSequence: 105,
					backwards: false,
					data: { balance: '20' },
					expirable: false
				})

				let p104 = readPoint({
					table: ctx.db.core.accountBalances,
					selector: { account, token },
					ledgerSequence: 104
				})
				expect(p104.balance.toString()).to.equal('15')

				let p105 = readPoint({
					table: ctx.db.core.accountBalances,
					selector: { account, token },
					ledgerSequence: 105
				})
				expect(p105.balance.toString()).to.equal('20')

				let p999 = readPoint({
					table: ctx.db.core.accountBalances,
					selector: { account, token },
					ledgerSequence: 999
				})
				expect(p999.balance.toString()).to.equal('20')
			}
		)

		it(
			'it should write a later forward non-expirable point at 220',
			() => {
				writePoint({
					table: ctx.db.core.accountBalances,
					selector: { account, token },
					ledgerSequence: 220,
					backwards: false,
					data: { balance: '70' },
					expirable: false
				})
			}
		)

		it(
			'it should write an earlier backfilled non-expirable point at 200',
			() => {
				writePoint({
					table: ctx.db.core.accountBalances,
					selector: { account, token },
					ledgerSequence: 200,
					backwards: true,
					data: { balance: '50' },
					expirable: false
				})
			}
		)

		it(
			'it should read sequences around both non-expirable points correctly',
			() => {
				let p199 = readPoint({
					table: ctx.db.core.accountBalances,
					selector: { account, token },
					ledgerSequence: 199
				})
				expect(p199.balance.toString()).to.equal('20')

				let p200 = readPoint({
					table: ctx.db.core.accountBalances,
					selector: { account, token },
					ledgerSequence: 200
				})
				expect(p200.balance.toString()).to.equal('50')

				let p210 = readPoint({
					table: ctx.db.core.accountBalances,
					selector: { account, token },
					ledgerSequence: 210
				})
				expect(p210.balance.toString()).to.equal('50')

				let p220 = readPoint({
					table: ctx.db.core.accountBalances,
					selector: { account, token },
					ledgerSequence: 220
				})
				expect(p220.balance.toString()).to.equal('70')

				let p221 = readPoint({
					table: ctx.db.core.accountBalances,
					selector: { account, token },
					ledgerSequence: 221
				})
				expect(p221.balance.toString()).to.equal('70')
			}
		)

		it(
			'it should create expirable open-ended offer at sequence 100',
			() => {
				writePoint({
					table: ctx.db.core.tokenOffers,
					selector: { account, accountSequence: 1, book },
					ledgerSequence: 100,
					backwards: false,
					data: { quality: '1', size: '100' },
					expirable: true
				})

				let o100 = readPoint({
					table: ctx.db.core.tokenOffers,
					selector: { account, accountSequence: 1, book },
					ledgerSequence: 100,
					expirable: true
				})
				expect(o100.quality.toString()).to.equal('1')
				expect(o100.size.toString()).to.equal('100')
			}
		)

		it(
			'it should read the open-ended offer later at sequence 150',
			() => {
				let o150 = readPoint({
					table: ctx.db.core.tokenOffers,
					selector: { account, accountSequence: 1, book },
					ledgerSequence: 150,
					expirable: true
				})
				expect(o150.size.toString()).to.equal('100')
			}
		)

		it(
			'it should evolve expirable offer at 160 closing previous interval',
			() => {
				writePoint({
					table: ctx.db.core.tokenOffers,
					selector: { account, accountSequence: 1, book },
					ledgerSequence: 160,
					backwards: false,
					data: { quality: '2', size: '80' },
					expirable: true
				})
			}
		)

		it(
			'it should read old value at 159 before evolution',
			() => {
				let o159 = readPoint({
					table: ctx.db.core.tokenOffers,
					selector: { account, accountSequence: 1, book },
					ledgerSequence: 159,
					expirable: true
				})
				expect(o159.size.toString()).to.equal('100')
			}
		)

		it(
			'it should read new value at 160 after evolution',
			() => {
				let o160 = readPoint({
					table: ctx.db.core.tokenOffers,
					selector: { account, accountSequence: 1, book },
					ledgerSequence: 160,
					expirable: true
				})
				expect(o160.size.toString()).to.equal('80')
			}
		)

		it(
			'it should expire expirable offer at 170 and close interval',
			() => {
				writePoint({
					table: ctx.db.core.tokenOffers,
					selector: { account, accountSequence: 1, book },
					ledgerSequence: 170,
					backwards: false,
					data: null,
					expirable: true
				})

				let o169 = readPoint({
					table: ctx.db.core.tokenOffers,
					selector: { account, accountSequence: 1, book },
					ledgerSequence: 169,
					expirable: true
				})
				expect(o169.size.toString()).to.equal('80')

				let o170 = readPoint({
					table: ctx.db.core.tokenOffers,
					selector: { account, accountSequence: 1, book },
					ledgerSequence: 170,
					expirable: true
				})
				expect(o170).to.equal(undefined)
			}
		)
	}
)
