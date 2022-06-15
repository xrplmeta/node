import log from '@mwni/log'
import { unixNow } from '@xrplkit/time'
import { spawn } from 'nanotasks'
import { open as openMetaStore } from '../../store/meta.js'
import { diff as diffLedgerObjects } from '../../core/diff/index.js'


export async function run({ ctx }){
	if(ctx.log)
		log.pipe(ctx.log)

	ctx.meta = openMetaStore({ ctx })
	ctx.snapshotState = ctx.meta.snapshots.readOne({ last: true })

	if(ctx.snapshotState && !ctx.snapshotState.marker && ctx.snapshotState.entriesCount > 0)
		return

	try{
		await copyFromFeed({ ctx, feed: await createFeed({ ctx })})
	}catch(error){
		log.error(`fatal error while copying from ledger feed:`)
		log.error(error.stack)

		throw error.stack
	}	
}

async function createFeed({ ctx }){
	let ledgerIndex

	if(ctx.snapshotState?.marker){
		ledgerIndex = ctx.snapshotState.ledgerIndex
		log.info(`resuming snapshot of ledger #${ledgerIndex}`)
	}else{
		let { result } = await ctx.xrpl.request({
			command: 'ledger', 
			ledger_index: 'validated'
		})

		ledgerIndex = parseInt(result.ledger.ledger_index)
		log.info(`creating snapshot of ledger #${ledgerIndex} - this may take a long time`)
	}

	return await spawn('../../lib/xrpl/snapshot.js:start', { ctx, ledgerIndex })
}


async function copyFromFeed({ ctx, feed }){
	ctx.ledgerIndex = feed.ledgerIndex
	ctx.forwardDiff = true

	if(!ctx.snapshotState){
		ctx.snapshotState = ctx.meta.snapshots.createOne({
			data: {
				ledgerIndex: feed.ledgerIndex,
				creationTime: unixNow(),
				originNode: feed.node
			}
		})
	}

	while(true){
		let chunk = await feed.next()
		
		if(!chunk)
			break
		
		ctx.meta.tx(async () => {
			diffLedgerObjects({
				ctx,
				deltas: chunk.objects.map(entry => ({ 
					type: entry.LedgerEntryType,
					final: entry 
				}))
			})
			
			ctx.snapshotState = ctx.meta.snapshots.updateOne({
				data: {
					marker: chunk.marker,
					entriesCount: ctx.snapshotState.entriesCount + chunk.objects.length
				},
				where: {
					ledgerIndex: ctx.ledgerIndex
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
	log.info(`ledger snapshot complete`)

	ctx.meta.snapshots.updateOne({
		data: {
			completionTime: unixNow(),
			marker: null
		},
		where: {
			ledgerIndex: feed.ledgerIndex
		}
	})
}