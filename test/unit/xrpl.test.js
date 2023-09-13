import { expect } from 'chai'
import { createPool } from '../../src/xrpl/nodepool.js'
import log from '@mwni/log'

log.config({ severity: 'error' })


describe(
	'Fetching from XRPL',
	() => {
		it(
			'should successfully retrieve ledger 80,000,000',
			async () => {
				let pool = createPool([{ url: 'wss://xrplcluster.com' }])
				let { result } = await pool.request({
					command: 'ledger',
					ledger_index: 80000000
				})

				expect(result.ledger.ledger_hash).to.be.equal('DB978F031BB14734213998060E077D5F813358222DAB07CA8148588D852A55DF')
			}
		)
	}
)