import log from '@xrplmeta/log'
import { wait, unixNow } from '@xrplmeta/utils'

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

export function getNext(task, entity){
	let table = entity === 'A'
		? 'Accounts'
		: 'Tokens'

	//WHERE clause currently only supports Accounts

	return this.get(
		`SELECT
			Operations.*, ${table}.id as entity
		FROM
			${table}
			LEFT JOIN Operations
				ON 
					Operations.task = ?
					AND
					Operations.subject = (? || ${table}.id)
		WHERE
			(SELECT COUNT(1) FROM Tokens WHERE issuer = ${table}.id) > 0
		GROUP BY
			Operations.subject
		ORDER BY
			(CASE WHEN start IS NULL THEN 1 ELSE 0 END) DESC,
			MAX(start) ASC`,
		task, entity
	)
}

export function hasCompleted(task, subject){
	let operation = this.operations.getMostRecent(task, subject)

	if(operation && operation.result === 'success')
		return true

	return false
}

export function getMostRecent(task, subject){
	return this.get(
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

export function mark(task, subject, start, result){
	this.insert({
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