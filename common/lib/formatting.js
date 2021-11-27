export function pretty(thing){
	if(typeof thing === 'number')
		return thing.toLocaleString('en-US')

	return thing
}
