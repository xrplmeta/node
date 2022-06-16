import * as parsers from './ops/parse.js'
import * as groupers from './ops/group.js'
import * as appliers from './ops/apply.js'
import { deriveDeltas } from './tx.js'


export function diff({ ctx, deltas, ledger }){
	let groups = {}

	if(!deltas){
		deltas = deriveDeltas({ ledger })
	}

	for(let { type, previous, final } of deltas){
		let parse = parsers[type]

		if(!parse)
			continue

		let parsedPrevious = previous 
			? parse({ entry: previous }) 
			: undefined

		let parsedFinal = final
			? parse({ entry: final }) 
			: undefined

		if(!parsedPrevious && !parsedFinal)
			continue

		let grouped = groupers[type]({ 
			previous: parsedPrevious, 
			final: parsedFinal 
		})

		for(let { key, previous, final } of grouped){
			if(!groups[type])
				groups[type] = {}

			if(!groups[type][key])
				groups[type][key] = []

			groups[type][key].push({ 
				previous, 
				final 
			})
		}
	}

	for(let [type, group] of Object.entries(groups)){
		let batches = Object.values(group)

		for(let deltas of batches){
			appliers[type]({ ctx, deltas })
		}
	}
}