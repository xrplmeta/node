import log from '../lib/log.js'
import { wait } from '@xrplworks/time'


export default class{
	constructor({ ledgerIndex, config, xrpl }){
		this.ledgerIndex = ledgerIndex
		this.chunkSize = config.ledger.snapshot.chunkSize || 10000
		this.xrpl = xrpl
		this.queue = []
		this.ongoing = true
		this.fill()
	}

	async fill(){
		let ledgerData
		let lastMarker
		let failed = false
		let attempts = 0

		while(true){
			while(this.queue.length >= this.chunkSize * 10)
				await wait(100)

			attempts++

			try{
				ledgerData = await this.xrpl.request({
					command: 'ledger_data',
					ledger_index: this.ledgerIndex,
					marker: lastMarker,
					limit: this.chunkSize,
					priority: 100
				})
			}catch(e){
				if(attempts >= 10){
					break
				}

				log.info(`could not obtain ledger data chunk:`, e)
				await wait(2500)
				continue
			}

			this.queue.push(...ledgerData.state)
			lastMarker = ledgerData.marker
			attempts = 0

			if(!lastMarker){
				this.complete = true
				break
			}
		}

		this.ongoing = false
	}
}