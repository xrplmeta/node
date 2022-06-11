import log from '@mwni/log'
import { rippleToUnix, wait } from '@xrplkit/time'

const concurrency = 4

export async function start({ config, xrpl, direction, startLedgerIndex }){
	let strideIndex = direction === 'forward' ? 1 : 1
	let currentIndex = startLedgerIndex
	let targetIndex
	let resolveNext
	let queue = {}

	if(direction === 'forward'){
		let { result } = await xrpl.request({ 
			command: 'ledger', 
			ledger_index: 'validated' 
		})

		targetIndex = parseInt(result.ledger.ledger_index)
	}else{
		targetIndex = 0
	}

	for(let n=0; n<concurrency; n++){
		(async () => {
			let index = currentIndex

			while(true){
				let stepsToTarget = (targetIndex - index) * strideIndex
	
				if(stepsToTarget < 0){
					await wait(100)
					continue
				}

				if(Object.keys(queue).length > 1000){
					await wait(1000)
					continue
				}

				if(queue.hasOwnProperty(index)){
					index += strideIndex
					continue
				}

				queue[index] = undefined

				try{
					let { result } = await xrpl.request({ 
						command: 'ledger', 
						ledger_index: index,
						transactions: true,
						expand: true
					})

					queue[index] = {
						index: index,
						hash: result.ledger.ledger_hash,
						closeTime: rippleToUnix(result.ledger.close_time),
						transactions: result.ledger.transactions
					}

					if(resolveNext)
						resolveNext()
						
				}catch(error){
					console.error(`failed to fetch ledger #${index}:`)
					console.error(error)
					delete queue[index]
				}
			}
		})()
	}

	return {
		async next(){
			while(!queue[currentIndex]){
				await new Promise(resolve => resolveNext = resolve)
			}

			let ledger = queue[currentIndex]
			let ledgersBehind = targetIndex - currentIndex

			delete queue[currentIndex]
			currentIndex++

			return { ledger, ledgersBehind }
		}
	}
}