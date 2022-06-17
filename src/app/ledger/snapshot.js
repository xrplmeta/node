import log from '@mwni/log'
import { unixNow } from '@xrplkit/time'
import { spawn } from 'nanotasks'
import { open as openMetaStore } from '../../store/meta.js'
import { diff as diffLedgerObjects } from '../../core/diff/index.js'
import { fetch as fetchLedger } from '../../lib/xrpl/ledger.js'
import { extract as extractLedgerMeta } from '../../lib/meta/generic/ledgers.js'
import { extract as extractTokenExchanges } from '../../lib/meta/token/exchanges.js'


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
	let ledgerSequence

	if(ctx.snapshotState){
		ledgerSequence = ctx.snapshotState.ledgerSequence
		log.info(`resuming snapshot of ledger #${ledgerSequence}`)
	}else{
		let ledger = await fetchLedger({ 
			ctx, 
			sequence: 'validated'
		})

		extractLedgerMeta({ ctx, ledger })
		extractTokenExchanges({ ctx, ledger })

		ledgerSequence = ledger.sequence
		log.info(`creating snapshot of ledger #${ledgerSequence} - this may take a long time`)
	}

	return await spawn('../../lib/xrpl/snapshot.js:start', { ctx, ledgerSequence })
}


async function copyFromFeed({ ctx, feed }){
	ctx.ledgerSequence = feed.ledgerSequence
	ctx.inSnapshot = true

	if(!ctx.snapshotState){
		ctx.snapshotState = ctx.meta.snapshots.createOne({
			data: {
				ledgerSequence: feed.ledgerSequence,
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
					ledgerSequence: ctx.ledgerSequence
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
			ledgerSequence: feed.ledgerSequence
		}
	})
}