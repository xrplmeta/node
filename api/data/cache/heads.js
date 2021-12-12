export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Heads" (
			"key"		TEXT NOT NULL UNIQUE,
			"sequence"	INTEGER NOT NULL UNIQUE
		);`
	)
}

export function set(key, sequence){
	this.insert({
		table: 'Heads',
		data: {
			key,
			sequence
		},
		duplicate: 'update'
	})
}

export function all(){
	let heads = {}
	let rows = this.all(`SELECT * FROM Heads`)

	for(let {key, sequence} of rows){
		heads[key] = sequence
	}

	return heads
}