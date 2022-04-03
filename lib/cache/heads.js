export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Heads" (
			"key"		TEXT NOT NULL UNIQUE,
			"sequence"	INTEGER NOT NULL
		);`
	)
}

export function set(heads){
	for(let [key, sequence] of Object.entries(heads)){
		this.insert({
			table: 'Heads',
			data: {
				key,
				sequence: sequence || 0
			},
			duplicate: 'update'
		})
	}
}

export function all(){
	let heads = {}
	let rows = this.all(`SELECT * FROM Heads`)

	for(let {key, sequence} of rows){
		heads[key] = sequence
	}

	return heads
}