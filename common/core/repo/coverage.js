import { log } from '../../lib/log.js'
import { wait, unixNow } from '../../lib/time.js'

export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Coverages" (
			"id"			INTEGER NOT NULL UNIQUE,
			"task"			TEXT,
			"head"			INTEGER,
			"tail"			INTEGER,
			PRIMARY KEY("id" AUTOINCREMENT)
		);
		CREATE INDEX IF NOT EXISTS "Coverages-T" ON "Coverages" ("task");
		CREATE INDEX IF NOT EXISTS "Coverages-H" ON "Coverages" ("head");`
	)
}

export async function get(task, index){
	return this.get(
		 `SELECT * FROM Coverages
		 WHERE task = ? 
		 AND head <= ? AND tail >= ?`,
		 task,
		 index,
		 index
	)
}

export async function extend(task, head, tail){
	let span = {
		head,
		tail: tail || head
	}

	let intersecting = await this.all(
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
		await this.run(`DELETE FROM Coverage WHERE id=?`, seg.id)
	}

	await this.insert(
		'Coverages',
		{
			task,
			...span
		}
	)
}