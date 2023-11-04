import { expect } from 'chai'
import { XFL } from '@xrplkit/xfl'
import { createContext } from './env.js'
import { readBalance, writeBalance } from '../../src/db/helpers/balances.js'
import { readTokenMetricSeries, writeTokenMetrics } from '../../src/db/helpers/tokenmetrics.js'


const ctx = await createContext()


describe(
	'Database Helpers',
	() => {
		it(
			'write and read token balance of account',
			() => {
				let account = {
					address: 'rMwNibdiFaEzsTaFCG1NnmAM3Rv3vHUy5L'
				}

				let token = {
					currency: 'PSC',
					issuer: {
						address: 'rwekfW4MiS5yZjXASRBDzzPPWYKuHvKP7E'
					}
				}
	
				writeBalance({
					ctx,
					account,
					token,
					ledgerSequence: 100000000,
					balance: '1000000'
				})

				let balance = readBalance({
					ctx,
					account,
					token,
					ledgerSequence: 100000000
				})

				expect(balance.toString()).to.be.equal('1000000')
			}
		)

		it(
			'write and read token metric series',
			() => {
				let token = {
					currency: 'PSC',
					issuer: {
						address: 'rwekfW4MiS5yZjXASRBDzzPPWYKuHvKP7E'
					}
				}

				for(let i=0; i<3; i++){
					writeTokenMetrics({
						ctx,
						token,
						ledgerSequence: 1000000 + i * 1000,
						metrics: {
							trustlines: 1 + i,
							supply: XFL(100 + i * 100)
						},
						updateCache: false
					})
				}

				let trustlineSeries = readTokenMetricSeries({
					ctx,
					token,
					sequenceStart: 0,
					metric: 'trustlines'
				})

				let supplySeries = readTokenMetricSeries({
					ctx,
					token,
					sequenceStart: 999999,
					metric: 'supply'
				})

				expect(trustlineSeries.map(e => e.value)).to.be.deep.equal([1, 2, 3])
				expect(supplySeries.map(e => e.value.toString())).to.be.deep.equal(['100', '200', '300'])
			}
		)
	}
)