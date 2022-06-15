import * as parsers from './ops/parse.js'
import * as groupers from './ops/group.js'
import * as appliers from './ops/apply.js'


export function diff({ ctx, deltas }){
	let groups = {}

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
		for(let deltas of Object.values(group)){
			appliers[type]({ ctx, deltas })
		}
	}
}