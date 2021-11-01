export function toRippledAmount(amount){
	if(amount.currency === 'XRP')
		return amount.value.times(1000000).toString()

	return {
		currency: amount.currency,
		issuer: amount.issuer,
		value: amount.value.toString()
	}
}

export function isBase58(str){
	return /^[rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz]+$/.test(str)
}