import log from '@mwni/log'
import { wait, unixNow } from '@xrplkit/time'
import { spawn } from 'nanotasks'
import { open as openStateStore } from '../../store/state.js'
import { write as writeToState } from '../../lib/ledger/write.js'


export async function run(ctx){
	if(ctx.log)
		log.pipe(ctx.log)

	let state = await openStateStore({ ...ctx, variant: 'current' })

	if(!await isIncomplete(state))
		return

	try{
		await copyFromFeed({ 
			...ctx, 
			state, 
			feed: await createFeed({ 
				...ctx, 
				state 
			})
		})
	}catch(error){
		log.error(`fatal error while copying from ledger feed:`)
		log.error(error.stack)

		throw error.stack
	}	
}

async function isIncomplete(state){
	let journal = await state.journal.readOne({ last: true })
	return !journal || journal.snapshotMarker || journal.entriesCount === 0
}

async function createFeed({ config, state, xrpl }){
	let journal = await state.journal.readOne({ last: true })
	let ledgerIndex
	let preferredNode
	let marker

	if(journal?.snapshotMarker){
		ledgerIndex = journal.ledgerIndex
		preferredNode = journal.snapshotOrigin
		marker = journal.snapshotMarker
		
		log.info(`resuming snapshot of ledger #${ledgerIndex}`)
	}else{
		let { result } = await xrpl.request({
			command: 'ledger', 
			ledger_index: 'validated'
		})

		ledgerIndex = parseInt(result.ledger.ledger_index)

		log.info(`creating snapshot of ledger #${ledgerIndex} - this may take a long time`)
	}

	return await spawn(
		'../../lib/xrpl/feed.js:create', 
		{ config, xrpl, ledgerIndex, preferredNode, marker }
	)
}


async function copyFromFeed({ config, state, feed }){
	let journal = await state.journal.readOne({ last: true })

	if(!journal){
		journal = await state.journal.createOne({
			data: {
				ledgerIndex: feed.ledgerIndex,
				creationTime: unixNow(),
				snapshotOrigin: feed.node
			}
		})
	}

	while(true){
		let chunk = await feed.next()
		
		if(!chunk)
			break
		
		await state.tx(async () => {
			for(let entry of chunk.objects){
				try{
					await writeToState({ state, entry, change: 'new' })
				}catch(error){
					log.error(`failed to add ${entry.LedgerEntryType} ledger object "${entry.index}":`)
					log.error(error.stack)
					throw error
				}
			}

			journal = await state.journal.createOne({
				data: {
					ledgerIndex: feed.ledgerIndex,
					snapshotMarker: chunk.marker,
					entriesCount: journal.entriesCount + chunk.objects.length
				}
			})
		})
		
		log.accumulate.info({
			line: [
				`copied`,
				journal.entriesCount, 
				`ledger objects (+%objects in %time)`
			],
			objects: chunk.objects.length
		})
	}

	log.flush()
	log.info(`ledger snapshot complete`)

	await state.journal.createOne({
		data: {
			ledgerIndex: feed.ledgerIndex,
			completionTime: unixNow(),
			snapshotMarker: null
		}
	})
	await state.compact()
}