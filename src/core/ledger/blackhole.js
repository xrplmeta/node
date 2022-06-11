const blackholeAccounts = [
	'rrrrrrrrrrrrrrrrrrrrrhoLvTp',
	'rrrrrrrrrrrrrrrrrrrrBZbvji',
	'rrrrrrrrrrrrrrrrrNAMEtxvNvQ',
	'rrrrrrrrrrrrrrrrrrrn5RM1rHd'
]

export function is(ledgerEntry){
	if(!blackholeAccounts.includes(ledgerEntry.RegularKey))
		return false

	// master key disabled
	if(ledgerEntry.Flags & 0x00100000 == 0)
		return false

	return true
}