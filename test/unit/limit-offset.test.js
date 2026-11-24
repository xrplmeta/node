import { expect } from 'chai'
import { sanitizeLimitOffset } from '../../src/srv/sanitizers/common.js'

const sanitize = sanitizeLimitOffset({ defaultLimit: 100, maxLimit: 1000 })

function rejects(params){
	try{
		sanitize(params)
	}catch(error){
		expect(error.type).to.equal('invalidParam')
		expect(error.expose).to.equal(true)
		return
	}

	throw new Error(`expected ${JSON.stringify(params)} to be rejected`)
}

describe('sanitizeLimitOffset', () => {
	it('uses the default limit and no offset when neither is given', () => {
		expect(sanitize({})).to.include({ limit: 100, offset: undefined })
		expect(sanitize({ limit: '', offset: '' })).to.include({ limit: 100, offset: undefined })
	})

	it('accepts a positive limit and caps it at the max', () => {
		expect(sanitize({ limit: '1' }).limit).to.equal(1)
		expect(sanitize({ limit: '250' }).limit).to.equal(250)
		expect(sanitize({ limit: 250 }).limit).to.equal(250)
		expect(sanitize({ limit: '5000' }).limit).to.equal(1000)
	})

	it('accepts a zero or positive offset', () => {
		expect(sanitize({ offset: '0' }).offset).to.equal(0)
		expect(sanitize({ offset: 0 }).offset).to.equal(0)
		expect(sanitize({ offset: '300' }).offset).to.equal(300)
	})

	it('rejects a zero or negative limit', () => {
		rejects({ limit: '0' })
		rejects({ limit: 0 })
		rejects({ limit: '-1' })
		rejects({ limit: -5 })
	})

	it('rejects a negative offset', () => {
		rejects({ offset: '-1' })
		rejects({ offset: -10 })
	})

	it('rejects non-integer values', () => {
		rejects({ limit: 'abc' })
		rejects({ limit: '1.5' })
		rejects({ limit: '10abc' })
		rejects({ limit: 1.5 })
		rejects({ offset: 'abc' })
		rejects({ offset: '2.5' })
	})

	it('passes other params through', () => {
		let ctx = {}
		let result = sanitize({ ctx, limit: '10', sort_by: 'holders' })

		expect(result.ctx).to.equal(ctx)
		expect(result.sort_by).to.equal('holders')
	})
})
