export function decimalCompare(a, b){
	if(!a || !b)
		return 0

	if(!b || a.gt(b))
		return 1
	else if(!a || b.gt(a))
		return -1
	else
		return 0
}