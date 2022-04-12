import log from '../lib/log.js'
import Snapshot from './model/index.js'
import Capture from './capture.js'
import { wait } from '@xrplworks/time'


export async function run({ config, xrpl }){
	let snapshot = new Snapshot(`${config.data.dir}/live.db`)
	let capture = new Capture({ config, xrpl })

	await snapshot.open()

	let captureRestoration = await snapshot.getCaptureRestoration()

	if(captureRestoration){
		await capture.start(captureRestoration)

		log.info(`resuming checkpoint capture at ledger #${captureRestoration.ledgerIndex}`)
	}else{
		let { result } = await xrpl.request({command: 'ledger', ledger_index: 'validated'})
		let ledgerIndex = parseInt(result.ledger.ledger_index)
		let ledgerCloseTime = new Date(Date.parse(result.ledger.close_time_human))

		await capture.start({ ledgerIndex })
		await snapshot.snapshotHistory.create({
			data: {
				ledgerIndex,
				ledgerCloseTime,
				diffed: false
			}
		})

		log.info(`capturing checkpoint at ledger #${ledgerIndex} - this may take a long time`)
	}


	while(capture.ongoing){
		let batch = capture.queue.splice(0, 100000)

		if(batch.length === 0){
			await wait(100)
			continue
		}

		await snapshot.tx(async () => {
			for(let state of batch){
				await snapshot.add(state)
			}

			await snapshot.snapshotHistory.update({
				data: {
					captureRestoration: JSON.stringify({
						marker: capture.marker,
						node: capture.assignedNode
					}),
					entriesCount: { increment: batch.length }
				},
				where: {
					ledgerIndex: capture.ledgerIndex
				}
			})
		})
	}
}
