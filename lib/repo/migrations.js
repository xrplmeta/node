import fs from 'fs'
import logc from '../log.js'

const log = logc.branch({name: 'repo'})

export function apply(db){
	if(db.newlyCreated)
		return

	if(db.version === 0){
		log.info(`migrating from v0 to v1`)
		log.info(`creating backup at ${db.file}.bk`)

		db.pragma(`WAL_CHECKPOINT(TRUNCATE)`)
		fs.copyFileSync(db.file, `${db.file}.bk`)

		db.dropIndices()

		db.exec(`ALTER TABLE Metas RENAME TO TokenMetas`)
		db.exec(`ALTER TABLE Exchanges RENAME TO TokenExchanges`)
		db.exec(`ALTER TABLE Stats RENAME TO TokenSnapshots`)
		db.exec(`ALTER TABLE Coverages RENAME TO LedgerDiscovery`)
		db.exec(`ALTER TABLE Ledgers RENAME TO LedgerCaptures`)
		db.exec(`ALTER TABLE States RENAME TO LedgerSnapshots`)
		db.exec(`DROP TABLE Offers`)

		log.info(`migration complete, clearing backup`)
		fs.unlinkSync(`${db.file}.bk`)

		db.version = 1
	}
}