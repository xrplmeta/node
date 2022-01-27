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
	repo.exec(`ALTER TABLE "main"."Trustlines" RENAME TO "Tokens"`)
})