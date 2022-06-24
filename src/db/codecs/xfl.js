import log from '@mwni/log'
import { XFL, toSortSafeBigInt } from '@xrplkit/xfl'

export default {
	acceptsFormat: 'xrpl/xfl',
	acceptsNull: true,
	returnsType: 'bigint',
	returnsNull: true,
	
	encode(data){
		try{
			return data !== null && data !== undefined 
				? toSortSafeBigInt(data) 
				: data
		}catch(error){
			log.error(`failed to encode XFL: ${data}`)
			log.error(error)
		}
	},

	decode(data){
		return data !== null && data !== undefined  
			? XFL.fromSortSafeBigInt(BigInt(data)) 
			: data
	}
}