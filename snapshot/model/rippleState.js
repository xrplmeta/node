import XFL from '@xrplworks/xfl'
import { encode as encodeCurrency } from '@xrplworks/currency'
import { decodeAccountID } from 'ripple-address-codec'
import log from '../../lib/log.js'


export default model => ({
	async add(ledgerObject){
		let code = encodeCurrency(ledgerObject.Balance.currency, 'binary')
		let lowAccount = decodeAccountID(ledgerObject.LowLimit.issuer)
		let highAccount = decodeAccountID(ledgerObject.HighLimit.issuer)
		let balance = new XFL(ledgerObject.Balance.value).toNative()

		await this.create({
			data: {
				currency: {
					connectOrCreate: {
						where: {code},
						create: {code}
					}
				},
				lowAccount: {
					connectOrCreate: {
						where: {address: lowAccount},
						create: {address: lowAccount},
					}
				},
				highAccount: {
					connectOrCreate: {
						where: {address: highAccount},
						create: {address: highAccount},
					}
				},
				balance,
			}
		})
	}
})