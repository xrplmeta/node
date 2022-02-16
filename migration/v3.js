import fs from 'fs'
import initRepo from '@xrplmeta/repo'


let repo = initRepo({
	data: {
		dir: 'V:/xrpl/xrplmeta'
	}
})


repo.tx(() => {
	repo.exec(`ALTER TABLE "main"."Stats" RENAME COLUMN "count" TO "trustlines"`)
	repo.exec(`ALTER TABLE "main"."Stats" RENAME COLUMN "trustline" TO "token"`)
	repo.exec(`ALTER TABLE "main"."Balances" RENAME COLUMN "trustline" TO "token"`)
	repo.exec(`ALTER TABLE "main"."States" RENAME COLUMN "currencies" TO "tokens"`)
	repo.exec(`DROP TABLE "Tokens"`)
	repo.exec(`DROP TABLE "Metas"`)
	repo.exec(`DROP TABLE "Operations"`)
	repo.exec(`ALTER TABLE "main"."Trustlines" RENAME TO "Tokens"`)
	repo.exec(`UPDATE Coverages SET task='backfill' WHERE task='ledgertx'`)
	repo.exec(`DELETE FROM Tokens WHERE (SELECT MAX(trustlines) FROM Stats WHERE Stats.token = Tokens.id) < 5`)
	repo.exec(`DELETE FROM Stats WHERE (SELECT COUNT(1) FROM Tokens WHERE Stats.token = Tokens.id) = 0`)
	repo.exec(`DELETE FROM Balances WHERE (SELECT COUNT(1) FROM Tokens WHERE Balances.token = Tokens.id) = 0`)
	repo.exec(`DELETE FROM Accounts WHERE (SELECT COUNT(1) FROM Tokens WHERE Accounts.id = Tokens.issuer) = 0`)
	repo.exec(`DELETE FROM Exchanges WHERE (SELECT COUNT(1) FROM Tokens WHERE Exchanges.base = Tokens.id OR Exchanges.quote = Tokens.id) = 0`)
})

repo.exec(`VACUUM`)