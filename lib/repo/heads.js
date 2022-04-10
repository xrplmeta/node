const tablemap = {
	tokens: 'Tokens',
	tokenSnapshots: 'TokenSnapshots',
	tokenMetas: 'TokenMetas',
	tokenExchanges: 'TokenExchanges'
}


export function all(){
	return Object.entries(tablemap)
		.reduce((map, [key, table]) => ({
			...map,
			[key]: this.getv(`SELECT MAX(id) FROM ${table}`)
		}), {})
}

export function diff(key, from, to){
	let table = tablemap[key]

	return this.all(
		`SELECT * FROM ${table} 
		WHERE id >= ? AND id <= ?`, 
		from, 
		to
	)
}