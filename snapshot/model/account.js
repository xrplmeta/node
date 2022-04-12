import log from "../../lib/log.js"
import XFL from '@xrplworks/xfl'
import { decodeAccountID } from 'ripple-address-codec'


export default model => ({
	async add(ledgerObject){
		await this.create({
			data: {
				address: decodeAccountID(ledgerObject.Account),
				balance: new XFL(ledgerObject.Balance).toNative(),
				emailHash: ledgerObject.EmailHash
					? Buffer.from(ledgerObject.EmailHash, 'hex')
					: undefined,
				domain: ledgerObject.Domain
					? Buffer.from(ledgerObject.Domain, 'hex')
					: undefined,
			}
		})
	}
})