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

let dates = oldDB.allv(`SELECT DISTINCT date FROM Stats`)

console.log(dates.length, 'dates')

repo.tx(() => {

	for(let date of dates){
		let stats = oldDB.all(`SELECT * FROM Stats WHERE date = ?`, date)
		let ledger = repo.get(`
			SELECT *, ABS("date" - ?) as dist FROM Ledgers
			WHERE dist <= 10
			ORDER BY dist
			LIMIT 1`,
			date
		)

		for(let stat of stats){
			let trustline = oldDB.get(`SELECT * FROM Trustlines WHERE id = ?`, stat.trustline)
			let issuerRow = oldDB.get(`SELECT * FROM Issuers WHERE id = ?`, trustline.issuer)
			let currency = currencyHexToUTF8(trustline.currency)
			let issuer = issuerRow.address
			let newTrustlineId = repo.trustlines.id({currency, issuer}, false)

			if(!newTrustlineId){
				console.log('skip', currency, issuer)
				continue
			}

			if(ledger){
				repo.run(`UPDATE Stats SET supply=? WHERE ledger = ? AND trustline = ?`,
					stat.supply, ledger.index, newTrustlineId)

				console.log('update', newTrustlineId, stat.supply)
			}else{
				let row = {
					trustline: newTrustlineId,
					ledger: date,
					count: stat.trustline,
					supply: stat.supply,
					ask: '0',
					bid: '0'
				}

				repo.stats.insert(row)
				console.log('insert', row)
			}

		}
	}

})