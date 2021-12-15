const tablemap = {
	trustlines: 'Trustlines',
	stats: 'Stats',
	metas: 'Metas',
	exchanges: 'Exchanges'
}


export function all(){
	return {
		trustlines: this.getv(`SELECT MAX(id) FROM Trustlines`),
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