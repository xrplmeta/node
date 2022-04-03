export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Coverages" (
			"id"			INTEGER NOT NULL UNIQUE,
			"task"			TEXT,
			"head"			INTEGER,
			"tail"			INTEGER,
			PRIMARY KEY("id" AUTOINCREMENT)
		);

		CREATE INDEX IF NOT EXISTS "CoveragesTask" ON "Coverages" ("task");
		CREATE INDEX IF NOT EXISTS "CoveragesHead" ON "Coverages" ("head");`
	)
}

export function get(task, index){
	return this.get(
		 `SELECT * FROM Coverages
		 WHERE task = ? 
		 AND head >= ? AND tail <= ?`,
		 task,
		 index,
		 index
	)
}

export function extend(task, head, tail){
	let span = {
		head,
		tail: tail || head
	}

	let intersecting = this.all(
		`SELECT * FROM Coverages 
		WHERE task = ?
		AND NOT (head < ? OR tail > ?)`,
		task,
		span.tail - 1,
		span.head + 1
	)

	for(let seg of intersecting){
		span.head = Math.max(span.head, seg.head)
		span.tail = Math.min(span.tail, seg.tail)
	}

	for(let seg of intersecting){
		this.run(`DELETE FROM Coverages WHERE id = ?`, seg.id)
	}

	this.insert({
		table: 'Coverages',
		data: {
			task,
			...span
		}
	})
}