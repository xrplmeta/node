import { expect } from 'chai'
import { createFetch } from '../../src/lib/fetch.js'



describe(
	'Fetching via HTTP',
	() => {
		it(
			'should successfully read text from https://static.xrplmeta.org/test.txt',
			async () => {
				let fetch = createFetch()
				let { data } = await fetch('https://static.xrplmeta.org/test.txt')

				expect(data).to.be.equal('it works')
			}
		)

		it(
			'should successfully read JSON from https://static.xrplmeta.org/test.json',
			async () => {
				let fetch = createFetch()
				let { data } = await fetch('https://static.xrplmeta.org/test.json')

				expect(data).to.be.deep.equal({ it: 'works' })
			}
		)
	}
)