import { log } from '../../lib/log.js'
import { wait, unixNow } from '../../lib/time.js'

export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Operations" (
			"id"		INTEGER NOT NULL UNIQUE,
			"task"		TEXT NOT NULL,
			"subject"	TEXT,
			"start"		INTEGER NOT NULL,
			"end"		INTEGER NOT NULL,
			"result"	TEXT NOT NULL,
			PRIMARY KEY ("id" AUTOINCREMENT),
			UNIQUE ("task", "subject")
		);`
	)
}

export async function getNext(task, entity){
	let table = entity === 'A'
		? 'Accounts'
		: 'Trustlines'

	return await this.get(
		`SELECT
			Operations.*, ${table}.id as entity
		FROM
			${table}
			LEFT JOIN Operations
				ON 
					Operations.task = ?
					AND
					Operations.subject = (? || ${table}.id)
		GROUP BY
			Operations.subject
		ORDER BY
			(CASE WHEN start IS NULL THEN 1 ELSE 0 END) DESC,
			MAX(start) ASC`,
		task, entity
	)
}

export async function hasCompleted(task, subject){
	let operation = await this.operations.getMostRecent(task, subject)

	if(operation && operation.result === 'success')
		return true

	return false
}

export async function getMostRecent(task, subject){
	return await this.get(
		`SELECT * 
		FROM Operations 
		WHERE task = ? AND subject IS ?
		ORDER BY start DESC`, 
		task, 
		subject || null
	)
}

export async function record(task, subject, promise){
	let start = unixNow()
	let result

	try{
		await promise
		result = 'success'
	}catch(error){
		if(subject)
			log.error(`operation "${task}/${subject}" failed:\n`, error)
		else
			log.error(`operation "${task}" failed:\n`, error)

		result = `error: ${error.toString()}`

		await wait(10000)
	}

	await this.operations.mark(task, subject, start, result)
}

export async function mark(task, subject, start, result){
	await this.insert({
		table: 'Operations',
		data: {
			task,
			subject,
			start,
			end: unixNow(),
			result
		},
		duplicate: 'replace'
	})
}