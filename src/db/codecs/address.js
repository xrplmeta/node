import { encodeAccountID, decodeAccountID } from 'ripple-address-codec'

export default {
	acceptsFormat: 'xrpl/address',
	acceptsNull: true,
	returnsType: 'blob',
	returnsNull: true,
	
	encode(data){
		return data ? decodeAccountID(data) : data
	},

	decode(data){
		return data ? encodeAccountID(data) : data
	}
}