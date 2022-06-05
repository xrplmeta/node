import { XFL, toBigInt } from '@xrplkit/xfl'

export default {
	acceptsFormat: 'xrpl/xfl',
	acceptsNull: true,
	returnsType: 'bigint',
	returnsNull: true,
	
	encode(data){
		return data !== null && data !== undefined 
			? toBigInt(data) 
			: data
	},

	decode(data){
		return data !== null && data !== undefined  
			? XFL(BigInt(data)) 
			: data
	}
}