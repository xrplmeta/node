export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "LedgerDiscovery" (
			"id"			INTEGER NOT NULL UNIQUE,
			"task"			TEXT,
			"head"			INTEGER,
			"tail"			INTEGER,
			PRIMARY KEY("id" AUTOINCREMENT)
		);

		CREATE INDEX IF NOT EXISTS "LedgerDiscoveryTask" ON "LedgerDiscovery" ("task");
		CREATE INDEX IF NOT EXISTS "LedgerDiscoveryHead" ON "LedgerDiscovery" ("head");`
	)
}

export function get(task, index){
	return this.get(
		 `SELECT * FROM LedgerDiscovery
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
		`SELECT * FROM LedgerDiscovery 
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
		this.run(`DELETE FROM LedgerDiscovery WHERE id = ?`, seg.id)
	}

	this.insert({
		table: 'LedgerDiscovery',
		data: {
			task,
			...span
		}
	})
}