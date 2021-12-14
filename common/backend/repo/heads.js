export function all(){
	return {
		trustlines: this.getv(`SELECT MAX(id) FROM Trustlines`),
		stats: this.getv(`SELECT MAX(id) FROM Stats`),
		metas: this.getv(`SELECT MAX(id) FROM Metas`),
		exchanges: this.getv(`SELECT MAX(id) FROM Exchanges`),
	}
}