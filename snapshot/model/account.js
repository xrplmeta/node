import log from "../../lib/log.js"
import XFL from '@xrplworks/xfl'
import { decodeAccountID } from 'ripple-address-codec'


export default model => ({
	async add(ledgerObject){
		let address = decodeAccountID(ledgerObject.Account)
		let balance = new XFL(ledgerObject.Balance).toNative()
		let emailHash
		let domain

		if(ledgerObject.EmailHash)
			emailHash = Buffer.from(ledgerObject.EmailHash, 'hex')

			if(ledgerObject.Domain)
			domain = Buffer.from(ledgerObject.Domain, 'hex')

		await this.upsert({
			create: {
				address,
				balance,
				emailHash,
				domain
			},
			update: {
				balance,
				emailHash,
				domain
			},
			where: {
				address
			}
		})
	}
})