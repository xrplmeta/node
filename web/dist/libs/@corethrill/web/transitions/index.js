import c from '@corethrill/core'


export const Component = node => {
	let dom
	let lastTick
	let inTransition
	let outTransition
	let currentTransition = null

	function tick(){
		if(!currentTransition)
			return

		let now = performance.now()
		let delta = now - lastTick
		let isIn = currentTransition.dir === 'in'
		let tt = now - currentTransition.start
		let t = Math.min(1, Math.max(0, tt / currentTransition.duration))

		for(let key in currentTransition.target){
			let initial = currentTransition.initial[key]
			let target = currentTransition.target[key]

			dom.style[key] = initial * (1-t) + target * t
		}

		if(tt >= currentTransition.duration){
			currentTransition.complete()
			return
		}

		lastTick = now
		requestAnimationFrame(tick)
	}

	function startTransition(transition, dir){
		cancelTransition()

		let initial = {}
		let st = dir === 'in' ? 0 : 1

		for(let key in transition.update(st)){
			initial[key] = dom.style[key]
		}

		lastTick = performance.now()
		currentTransition = {
			duration: transition.duration,
			start: lastTick,
			target: transition.update(1-st),
			initial,
			dir
		}

		return new Promise(resolve => {
			currentTransition.complete = resolve
			tick()
		})

	}

	function cancelTransition(){
		if(!currentTransition)
			return

		currentTransition = null
	}

	return {
		oncreate: node => {
			let opts = node.attrs

			inTransition = opts.in
			outTransition = opts.out
			dom = node.dom

			if(inTransition){
				startTransition(inTransition, 'in')
			}
		},

		onbeforeremove: node => {
			if(outTransition){
				return startTransition(outTransition, 'out')
			}else{
				cancelTransition()
			}
		},

		view: node => c('[', node.children[0])
	}
}

export const fade = opts => ({
	duration: opts.duration,
	update: t => ({
		opacity: t
	})
})