import { unixNow, rippleToUnix, wait } from '@xrplkit/time'
import log from '@mwni/log'
import startSnapshot from '../xrpl/helpers/snapshot.js'


export async function create({ config, xrpl, ledger }){
	let state = await ledger.journal.readOne({ last: true })
	let ledgerIndex
	let preferredNode
	let marker

	if(state?.snapshotMarker){
		ledgerIndex = state.ledgerIndex
		preferredNode = state.snapshotOrigin
		marker = state.snapshotMarker
		
		log.info(`resuming snapshot of ledger #${ledgerIndex}`)
	}else{
		let { result } = await xrpl.request({command: 'ledger', ledger_index: 'validated'})

		ledgerIndex = parseInt(result.ledger.ledger_index)

		log.info(`creating snapshot of ledger #${ledgerIndex} - this may take a long time`)
	}

	let snap = await startSnapshot({ config, xrpl, ledgerIndex, preferredNode, marker })

	while(!snap.done){
		let batch = snap.queue.splice(0, 10000)

		if(batch.length === 0){
			await wait(100)
			continue
		}

		await ledger.tx(async ledger => {
			for(let object of batch){
				try{
					await ledger.addNativeEntry(object)
				}catch(error){
					log.error(`failed to add ledger object:`, object)
					throw error
				}
			}

			state = await ledger.journal.createOne({
				data: {
					ledgerIndex,
					time: unixNow(),
					snapshotOrigin: snap.node,
					snapshotMarker: snap.marker,
					entriesCount: batch.length + (state?.entriesCount || 0)
				}
			})
		})

		
		log.accumulate.info({
			line: [
				`captured`,
				await state.entriesCount, 
				`ledger objects (+%objects in %time)`
			],
			objects: batch.length
		})
	}

	log.flush()
	log.info(`ledger snapshot complete`)

	await ledger.journal.createOne({
		data: {
			ledgerIndex,
			snapshotMarker: null
		}
	})
}