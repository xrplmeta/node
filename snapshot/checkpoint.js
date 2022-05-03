import log from '../lib/log.js'
import Capture from '../xrpl/helpers/capture.js'
import { unixNow, wait } from '@xrplworks/time'

export default class Checkpoint{
	constructor({ snapshot, xrpl, config }){
		this.snapshot = snapshot
		this.xrpl = xrpl
		this.config = config
	}

	async create(){
		let state = await this.snapshot.journal.readOne({take: -1})

		if(!state || state.captureMarker){
			let capture = new Capture({ config: this.config, xrpl: this.xrpl })

			if(state?.captureMarker){
				await capture.start(state.captureMarker)
				log.info(`resuming checkpoint capture at ledger #${state.ledgerIndex}`)
			}else{
				let { result } = await this.xrpl.request({command: 'ledger', ledger_index: 'validated'})
				let ledgerIndex = parseInt(result.ledger.ledger_index)
				let ledgerCloseTime = Date.parse(result.ledger.close_time_human) / 1000
		
				await capture.start({ ledgerIndex })

				state = await this.snapshot.journal.createOne({
					data: {
						time: unixNow(),
						ledgerIndex,
						ledgerCloseTime,
						isCheckpoint: true,
						captureMarker: capture.marker
					}
				})
		
				log.info(`capturing checkpoint at ledger #${ledgerIndex} - this may take a long time`)
			}

			while(capture.ongoing){
				let batch = capture.queue.splice(0, 10000)
		
				if(batch.length === 0){
					await wait(100)
					continue
				}
		
				await this.snapshot.tx(async snapshot => {
					for(let object of batch){
						try{
							await snapshot.add(object)
						}catch(error){
							log.error(`failed to add ledger object:`, object)
							throw error
						}
					}

					await state.update({
						data: {
							captureMarker: capture.marker,
							entriesCount: state.entriesCount + batch.length
						}
					})
				})
		
				
				log.accumulateInfo({
					line: [
						`captured`,
						await state.entriesCount, 
						`ledger objects (+%objects in %time)`
					],
					objects: batch.length
				})
			}
		}
	}
}

export async function run({ config, xrpl }){
	let snapshot = new Snapshot(`${config.data.dir}/live.db`)
	
}
