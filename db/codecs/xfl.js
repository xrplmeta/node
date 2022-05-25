import { toBigInt, XFL } from '@xrplkit/xfl'

export default {
	acceptsFormat: 'xrpl/xfl',
	acceptsNull: true,
	returnsType: 'bigint',
	returnsNull: true,
	
	encode(data){
		return data ? toBigInt(data) : data
	},

	decode(data){
		return data ? XFL(data) : data
	}
}