import { expect } from 'chai'
import codecs from '../../src/db/codecs/index.js'
import { XFL } from '@xrplkit/xfl'


const testValues = {
	'xrpl/xfl': XFL('123.456'),
	'xrpl/address': 'rwekfW4MiS5yZjXASRBDzzPPWYKuHvKP7E'
}


describe(
	'Database Codecs',
	() => {
		for(let { acceptsFormat, returnsType, encode, decode } of codecs){
			it(
				`should return same for ${acceptsFormat} -> ${returnsType} -> ${acceptsFormat}`,
				() => {
					let testValue = testValues[acceptsFormat]
					let decodedValue = decode(encode(testValue))

					expect(testValue.toString()).to.be.equal(decodedValue.toString())
				}
			)
		}
	}
)