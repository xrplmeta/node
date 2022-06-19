import log from '@mwni/log'
import { unixNow } from '@xrplkit/time'
import { spawn } from 'nanotasks'
import { open as openMetaStore } from '../../store/meta.js'
import { diff as diffLedgerObjects } from '../../core/diff/index.js'
import { fetch as fetchLedger } from '../../lib/xrpl/ledger.js'
import { extract as extractLedgerMeta } from '../../lib/meta/generic/ledgers.js'
import { extract as extractTokenExchanges } from '../../lib/meta/token/exchanges.js'
import { updateAll as updateAllMarketcaps } from '../../core/postdiff/marketcap.js'
import { updateAll as updateAllOfferFunds } from '../../core/postdiff/offerfunds.js'


export async function run({ ctx }){
	if(ctx.log)
		log.pipe(ctx.log)

	ctx.meta = openMetaStore({ ctx })
	ctx.snapshotState = ctx.meta.snapshots.readOne({ last: true })

	if(!ctx.snapshotState){
		await createSnapshotEntry({ ctx })
		
		log.info(`creating snapshot of ledger #${ctx.snapshotState.ledgerSequence} - this may take a long time`)
	}else{
		log.info(`resuming snapshot of ledger #${ctx.snapshotState.ledgerSequence}`)
	}

	ctx.ledgerSequence = ctx.snapshotState.ledgerSequence
	ctx.inSnapshot = true

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
		applyPostDiffs({ ctx })

		ctx.meta.snapshots.updateOne({
			data: {
				completionTime: unixNow(),
				marker: null
			},
			where: {
				ledgerSequence: ctx.snapshotState.ledgerSequence
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

	extractLedgerMeta({ ctx, ledger })
	extractTokenExchanges({ ctx, ledger })

	ctx.snapshotState = ctx.meta.snapshots.createOne({
		data: {
			ledgerSequence: feed.ledgerSequence,
			creationTime: unixNow(),
			originNode: feed.node
		}
	})
}

async function createFeed({ ctx }){
	return await spawn(
		'../../lib/xrpl/snapshot.js:start', 
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
	log.info(`reached end of ledger data`)
}


function applyPostDiffs({ ctx }){
	log.info(`applying postdiff operations ...`)

	log.time.info(`marketcaps`, `calculating marketcaps ...`)
	updateAllMarketcaps({ ctx })
	log.time.info(`marketcaps`, `calculated marketcaps in %`)

	log.time.info(`offerfunds`, `constraining offer funds ...`)
	updateAllOfferFunds({ ctx })
	log.time.info(`offerfunds`, `constrained offer funds in %`)
}