import { XFL, toSortSafeBigInt } from '@xrplkit/xfl'

export default {
	acceptsFormat: 'xrpl/xfl',
	acceptsNull: true,
	returnsType: 'bigint',
	returnsNull: true,
	
	encode(data){
		return data !== null && data !== undefined 
			? toSortSafeBigInt(data) 
			: data
	},

	decode(data){
		return data !== null && data !== undefined  
			? XFL.fromSortSafeBigInt(BigInt(data)) 
			: data
	}
}