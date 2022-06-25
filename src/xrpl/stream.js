import { wait } from '@xrplkit/time'
import { fetch as fetchLedger } from './ledger.js'



export async function createForwardStream({ ctx, startSequence }){
	let latestLedger = await fetchLedger({ 
		ctx,
		sequence: 'validated' 
	})

	let stream = createRegistry({
		startSequence,
		targetSequence: latestLedger.sequence,
		maxSize: ctx.config.ledger.streamQueueSize || 100
	})

	ctx.xrpl.on('ledger', ledger => {
		stream.put(ledger)
	})

	createFiller({ ctx, stream, stride: 1 })
	
	return stream
}


function createRegistry({ startSequence, targetSequence, maxSize }){
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

		get isFull(){
			return Object.keys(ledgers).length > maxSize
		},

		put(ledger){
			targetSequence = Math.max(targetSequence, ledger.sequence)

			if(ledger.sequence - currentSequence > maxSize)
				return

			ledgers[ledger.sequence] = ledger
			resolveNext()
		},

		has(sequence){
			return !!ledgers[sequence]
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
	
				if(stepsToTarget < 0){
					await wait(100)
					continue
				}

				if(stream.isFull){
					await wait(1000)
					continue
				}

				if(reservations[sequence] || stream.has(sequence)){
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
					console.warn(`failed to fetch ledger #${index}:`)
					console.warn(error)
				}finally{
					delete reservations[sequence]
				}
			}
		})()
	}
}