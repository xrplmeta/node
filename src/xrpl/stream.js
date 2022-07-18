import log from '@mwni/log'
import { wait } from '@xrplkit/time'
import { fetch as fetchLedger } from './ledger.js'



export async function createForwardStream({ ctx, startSequence }){
	if(ctx.log)
		log.pipe(ctx.log)

	let latestLedger = await fetchLedger({ 
		ctx,
		sequence: 'validated' 
	})

	let stream = createRegistry({
		name: 'live',
		startSequence,
		targetSequence: latestLedger.sequence,
		maxSize: ctx.config.etl.streamQueueSize || 100
	})

	ctx.xrpl.on('ledger', ledger => {
		stream.extend(ledger)
	})

	createFiller({ ctx, stream, stride: 1 })
	
	return stream
}

export async function createBackwardStream({ ctx, startSequence }){
	if(ctx.log)
		log.pipe(ctx.log)

	let stream = createRegistry({
		name: 'backfill',
		startSequence,
		targetSequence: 0,
		maxSize: ctx.config.etl.streamQueueSize || 100
	})

	createFiller({ ctx, stream, stride: -1 })
	
	return stream
}


function createRegistry({ name, startSequence, targetSequence, maxSize }){
	let currentSequence = startSequence
	let ledgers = {}
	let resolveNext = () => 0

	return {
		get currentSequence(){
			return currentSequence
		},

		get targetSequence(){
			return targetSequence
		},

		get queueSize(){
			return Object.keys(ledgers).length
		},

		has(sequence){
			return !!ledgers[sequence]
		},

		accepts(sequence){
			return Math.abs(sequence - currentSequence) <= maxSize
		},

		extend(ledger){
			targetSequence = Math.max(targetSequence, ledger.sequence)

			if(this.accepts(ledger.sequence))
				this.put(ledger)
		},

		put(ledger){
			ledgers[ledger.sequence] = ledger
			resolveNext()

			if(this.queueSize > 1){
				log.accumulate.debug({
					text: [
						`${name} queue has`,
						this.queueSize,
						`ledgers`,
						`(+%${name}QueueAdd in %time)`
					],
					data: {
						[`${name}QueueAdd`]: 1
					}
				})
			}
		},

		status(){
			return {
				currentSequence,
				targetSequence
			}
		},

		async next(){
			while(!ledgers[currentSequence]){
				await new Promise(resolve => resolveNext = resolve)
			}

			let ledger = ledgers[currentSequence]

			delete ledgers[currentSequence]

			currentSequence += targetSequence >= currentSequence ? 1 : -1

			return {
				ledger,
				ledgersBehind: targetSequence - currentSequence
			}
		}
	}
}

function createFiller({ ctx, stream, stride }){
	let reservations = {}

	for(let n=0; n<ctx.xrpl.connectionsCount; n++){
		(async () => {
			let sequence = stream.currentSequence

			while(true){
				let stepsToTarget = (stream.targetSequence - sequence) * stride
				let stepsBehindCurrent = (stream.currentSequence - sequence) * stride
	
				if(stepsToTarget < 0){
					await wait(100)
					continue
				}

				if(!stream.accepts(sequence)){
					await wait(1000)
					continue
				}

				if(stepsBehindCurrent > 0 || reservations[sequence] || stream.has(sequence)){
					sequence += stride
					continue
				}

				reservations[sequence] = true

				try{
					stream.put(
						await fetchLedger({ 
							ctx, 
							sequence 
						})
					)	
				}catch(error){
					console.warn(`failed to fetch ledger #${sequence}:`)
					console.warn(error)
				}finally{
					delete reservations[sequence]
				}
			}
		})()
	}
}