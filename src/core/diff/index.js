import * as parsers from './ops/parse.js'
import * as groupers from './ops/group.js'
import * as appliers from './ops/apply.js'
import { deriveDeltas } from './tx.js'


export function diff({ ctx, deltas, ledger }){
	let groups = {}

	if(!deltas){
		deltas = deriveDeltas({ ledger })
		ctx = { ...ctx, ledgerSequence: ledger.sequence }
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

		for(let { group, previous, final } of grouped){
			if(!groups[group.key])
				groups[group.key] = {
					...group,
					deltas: []
				}

			groups[group.key].deltas.push({
				previous,
				final
			})
		}
	}

	for(let { type, key, ...group } of Object.values(groups)){
		appliers[type]({ ctx, ...group })
	}

	return Object.values(groups).reduce(
		(subjects, { key, deltas, ...group }) => {
			subjects[key] = group
			return subjects
		},
		{}
	)
}