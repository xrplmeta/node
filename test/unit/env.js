import os from 'os'
import fs from 'fs'
import path from 'path'
import log from '@mwni/log'
import { openDB } from '../../src/db/index.js'
import coreSchema from '../../src/db/schemas/core.json' with { type: 'json' }

export function readLedgerTxTypeCounts({ ctx, sequence }){
	let typeEnum = coreSchema.definitions.LedgerTxTypeCount.properties.type.enum
	let rows = ctx.db.core.database.all({
		text: `SELECT c.type AS type, c.count AS count FROM LedgerTxTypeCount c JOIN Ledger l ON l.id = c.ledger WHERE l.sequence = ?`,
		values: [sequence]
	})

	return Object.fromEntries(
		rows.map(({ type, count }) => [typeEnum[Number(type)], Number(count)])
	)
}

export async function createContext({ debugQueries=false }={}){
	let dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xrplmeta-test-'))
	
	let ctx = {
		config: {
			node: {
				dataDir
			},
			debug: {
				queries: debugQueries
			}
		}
	}

	log.config({ level: 'error' })

	return {
		...ctx,
		db: await openDB({
			inMemory: true,
			ctx
		})
	}
}