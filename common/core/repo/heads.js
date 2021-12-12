export function all(){
	return {
		Trustlines: this.getv(`SELECT MAX(id) FROM Trustlines`),
		Stats: this.getv(`SELECT MAX(id) FROM Stats`),
		Metas: this.getv(`SELECT MAX(id) FROM Metas`),
		Exchanges: this.getv(`SELECT MAX(id) FROM Exchanges`),
	}
}