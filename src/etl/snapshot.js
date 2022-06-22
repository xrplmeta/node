import log from '@mwni/log'
import { unixNow } from '@xrplkit/time'
import { spawn } from 'nanotasks'
import { fetch as fetchLedger } from '../xrpl/ledger.js'
import { applyObjects } from './state/apply.js'
import { extractEvents } from './events/extract.js'
import { deriveAllComposites } from './composites/derive.js'
import { buildAllAggregates } from './aggregates/build.js'


export async function createSnapshot({ ctx }){
	ctx = {
		...ctx,
		snapshotState: ctx.db.snapshots.readLast()
	}

	if(!ctx.snapshotState){
		await createSnapshotEntry({ ctx })

		log.info(`creating snapshot of ledger #${ctx.snapshotState.ledgerSequence} - this may take a long time`)
	}else{
		log.info(`resuming snapshot of ledger #${ctx.snapshotState.ledgerSequence}`)
	}

	ctx.inSnapshot = true
	ctx.ledgerSequence = 0
	ctx.affectedScope = () => null

	if(ctx.snapshotState.entriesCount === 0 || ctx.snapshotState.marker){
		try{
			await copyFromFeed({
				ctx,
				feed: await createFeed({
					ctx,
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
		log.time.info(`snapshot.composites`, `deriving composites (1/2) ...`)
		deriveAllComposites({ ctx })
		log.time.info(`snapshot.composites`, `derived composites in %`)

		log.time.info(`snapshot.aggregates`, `building aggregates (2/2) ...`)
		buildAllAggregates({ ctx })
		log.time.info(`snapshot.aggregates`, `built aggregates in %`)

		ctx.db.snapshots.updateOne({
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

	ctx.snapshotState = ctx.db.snapshots.createOne({
		data: {
			ledgerSequence: ledger.sequence,
			creationTime: unixNow()
		}
	})
}

async function createFeed({ ctx }){
	return await spawn(
		'../xrpl/snapshot.js:start', 
		{ 
			ctx, 
			ledgerSequence: ctx.snapshotState.ledgerSequence 
		}
	)
}


async function copyFromFeed({ ctx, feed }){
	while(true){
		let chunk = await feed.next()
		
		if(!chunk)
			break
		
		ctx.db.tx(() => {
			applyObjects({
				ctx,
				objects: chunk.objects
			})
			
			ctx.snapshotState = ctx.db.snapshots.updateOne({
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