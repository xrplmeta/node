const tablemap = {
	tokens: 'Tokens',
	stats: 'Stats',
	metas: 'Metas',
	exchanges: 'Exchanges',
	updates: 'Updates'
}


export function all(){
	return Object.entries(tablemap)
		.reduce((map, [key, table]) => ({
			[key]: this.getv(`SELECT MAX(id) FROM ${table}`)
		}))
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