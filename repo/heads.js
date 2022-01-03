const tablemap = {
	tokens: 'Tokens',
	stats: 'Stats',
	metas: 'Metas',
	exchanges: 'Exchanges'
}


export function all(){
	return {
		tokens: this.getv(`SELECT MAX(id) FROM Tokens`),
		stats: this.getv(`SELECT MAX(id) FROM Stats`),
		metas: this.getv(`SELECT MAX(id) FROM Metas`),
		exchanges: this.getv(`SELECT MAX(id) FROM Exchanges`),
	}
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