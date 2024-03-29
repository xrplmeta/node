import log from '@mwni/log'
import { unixNow } from '@xrplkit/time'
import { spawn } from '@mwni/workers'
import { fetch as fetchLedger } from '../xrpl/ledger.js'
import { applyObjects } from './state/index.js'
import { extractEvents } from './events/index.js'
import { createAllDerivatives } from './derivatives/index.js'


export async function createSnapshot({ ctx }){
	ctx = {
		...ctx,
		snapshotState: ctx.db.core.snapshots.readLast(),
		ledgerSequence: 0
	}

	if(!ctx.snapshotState){
		await createSnapshotEntry({ ctx })
		log.info(`creating snapshot of ledger #${ctx.snapshotState.ledgerSequence} - this may take a long time`)
	}

	if(ctx.snapshotState.entriesCount === 0 || ctx.snapshotState.marker){
		try{
			await copyFromFeed({
				ctx,
				feed: await createFeed({
					ctx,
					ledgerSequence: ctx.snapshotState.ledgerSequence,
					marker: ctx.snapshotState.marker,
					node: ctx.snapshotState.originNode
				})
			})
		}catch(error){
			log.error(`fatal error while copying from ledger feed:`)
			log.error(error.stack)
	
			throw error.stack
		}
	}

	if(!ctx.snapshotState.completionTime){
		log.time.info(`snapshot.derivatives`, `creating derivative data ...`)
		createAllDerivatives({ ctx })
		log.time.info(`snapshot.derivatives`, `created derivative data in %`)

		ctx.db.core.snapshots.updateOne({
			data: {
				completionTime: unixNow(),
				marker: null
			},
			where: {
				id: ctx.snapshotState.id
			}
		})

		log.info(`ledger snapshot complete`)
	}
}

async function createSnapshotEntry({ ctx }){
	let ledger = await fetchLedger({ 
		ctx, 
		sequence: 'validated'
	})

	extractEvents({ ctx, ledger })

	ctx.currentLedger = ledger
	ctx.snapshotState = ctx.db.core.snapshots.createOne({
		data: {
			ledgerSequence: ledger.sequence,
			creationTime: unixNow()
		}
	})
}

async function createFeed({ ctx, ledgerSequence, marker, node }){
	return await spawn(
		'../xrpl/snapshot.js:start', 
		{ 
			ctx, 
			ledgerSequence,
			marker,
			node
		}
	)
}


async function copyFromFeed({ ctx, feed }){
	while(true){
		let chunk = await feed.next()
		
		if(!chunk)
			break
		
		ctx.db.core.tx(() => {
			applyObjects({
				ctx,
				objects: chunk.objects
			})
			
			ctx.snapshotState = ctx.db.core.snapshots.updateOne({
				data: {
					originNode: feed.node,
					marker: chunk.marker,
					entriesCount: ctx.snapshotState.entriesCount + chunk.objects.length
				},
				where: {
					id: ctx.snapshotState.id
				}
			})
		})
		
		log.accumulate.info({
			text: [
				`processed`,
				ctx.snapshotState.entriesCount, 
				`ledger objects (+%objects in %time)`
			],
			data: {
				objects: chunk.objects.length
			}
		})
	}

	log.flush()
	log.info(`reached end of ledger data`)
}