import { expect } from 'chai'
import { reduceProps } from '../../src/srv/procedures/token.js'


const props = [
	{
		key: 'name',
		value: 'US Dollar',
		source: 'xumm/curated'
	},
	{
		key: 'name',
		value: 'U.S. Dollar',
		source: 'trustlist'
	},
	{
		key: 'name',
		value: 'Dollar',
		source: 'xrpscan/well-known'
	},
	{
		key: 'name',
		value: 'USD',
		source: 'bithomp'
	},
]


describe(
	'Ranking props by source',
	() => {
		it(
			'should pick the first when no ranking given',
			() => {
				expect(reduceProps({ props }).name).to.be.equal(props[0].value)
			}
		)

		it(
			'should pick identical sources',
			() => {
				expect(
					reduceProps({
						props,
						sourceRanking: [
							'trustlist',
							'xumm',
							'bithomp'
						]
					}).name
				).to.be.equal(props[1].value)

				expect(
					reduceProps({
						props,
						sourceRanking: [
							'xumm/curated',
							'trustlist',
							'bithomp'
						]
					}).name
				).to.be.equal(props[0].value)
			}
		)

		it(
			'should pick wildcarded sources',
			() => {
				expect(
					reduceProps({
						props,
						sourceRanking: [
							'xrpscan',
							'trustlist',
							'xumm'
						]
					}).name
				).to.be.equal(props[2].value)
			}
		)
	}
)