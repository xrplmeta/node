import DB from '@xrplmeta/common/lib/db.js'
import initRepo from '@xrplmeta/common/core/repo.js'
import { currencyHexToUTF8 } from '@xrplmeta/common/lib/xrpl.js'



let oldDB = new DB({
	file: '/Users/mwni/Documents/xrpl/meta.db'
})

let repo = initRepo({
	data: {
		dir: '/Users/mwni/Documents/xrplv2'
	}
})

let dates = oldDB.allv(`SELECT DISTINCT date FROM Distributions`)

console.log(dates.length, 'dates')

repo.tx(() => {

	for(let date of dates){
		let distribs = oldDB.all(`SELECT * FROM Distributions WHERE date = ?`, date)
		let ledger = repo.get(`
			SELECT *, ABS("date" - ?) as dist FROM Ledgers
			WHERE dist <= 10
			ORDER BY dist
			LIMIT 1`,
			date
		)

		for(let distrib of distribs){
			let trustline = oldDB.get(`SELECT * FROM Trustlines WHERE id = ?`, distrib.trustline)
			let issuerRow = oldDB.get(`SELECT * FROM Issuers WHERE id = ?`, trustline.issuer)
			let currency = currencyHexToUTF8(trustline.currency)
			let issuer = issuerRow.address
			let newTrustlineId = repo.trustlines.id({currency, issuer}, false)

			if(!newTrustlineId){
				console.log('skip', distrib)
				continue
			}

			repo.insert({
				table: 'Distributions',
				data: {
					trustline: newTrustlineId,
					ledger: ledger ? ledger.index : date,
					percent: distrib.percent,
					share: distrib.share
				}
			})

			console.log('inserted', {
					trustline: newTrustlineId,
					ledger: ledger ? ledger.index : date,
					percent: distrib.percent,
					share: distrib.share
				})
		}
	}

})