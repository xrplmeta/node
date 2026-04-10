import log from '@mwni/log'
import { spawn } from '@mwni/workers'
import { applyLedgerEvents } from './events/index.js'
import { createMissingMPTokenIssuanceFromTransactions } from '../xrpl/mpt.js'
import { applyLedgerStateFromTransactions } from './state/index.js'
import { updateDerived } from './derived/index.js'
import { pullNewItems, readTableHeads } from '../db/helpers/heads.js'


export async function startSync({ ctx }){
	let onceInSyncTrigger

	let { sequence: lastSequence } = ctx.db.core.ledgers.readOne({
		orderBy: {
			sequence: 'desc'
		},
		take: 1
	})
	
	let stream = await spawn(
		'../xrpl/stream.js:createForwardStream',
		{
			ctx,
			startSequence: lastSequence + 1 
		}
	)

	log.info(`catching up from ledger #${lastSequence} -> #${(await stream.status()).targetSequence}`)
	
	;(async () => {
		while(true){
			log.time.debug(`sync.cycle`)

			let { ledger, ledgersBehind } = await stream.next()

			await createMissingMPTokenIssuanceFromTransactions({ ctx, ledger })

			ctx.db.core.tx(() => {
				ctx = {
					...ctx,
					currentLedger: ledger,
					ledgerSequence: ledger.sequence,
				}
	
				try{
					let heads = readTableHeads({ ctx })
	
					applyLedgerEvents({ ctx, ledger })
					applyLedgerStateFromTransactions({ ctx, ledger })
					updateDerived({ 
						ctx,
						newItems: pullNewItems({ 
							ctx, 
							previousHeads: heads 
						})
					})
				}catch(error){
					log.error(`fatal error while syncing ledger #${ledger.sequence}:`)
					log.error(error.stack)
	
					throw error
				}
			})
	
	
			if(ledgersBehind > 0){
				log.accumulate.info({
					text: [
						ledgersBehind,
						`ledgers behind (+%advancedLedgers in %time)`
					],
					data: {
						advancedLedgers: 1
					}
				})
			}else{
				log.flush()
	
				if(onceInSyncTrigger){
					onceInSyncTrigger()
					onceInSyncTrigger = undefined
					log.info(`catched up with live`)
				}
	
				log.info(`in sync with ledger #${ledger.sequence} ${
					new Date(ledger.closeTime * 1000)
						.toISOString()
						.slice(0, -5)
						.replace('T', ' ')
				}`)
			}

			log.time.debug(`sync.cycle`, `sync cycle took % for`, ledger.transactions.length, `tx`)
		}
	})()

	return {
		onceInSync(){
			return new Promise(resolve => {
				onceInSyncTrigger = resolve
			})
		}
	}
}