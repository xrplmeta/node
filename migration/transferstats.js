import fs from 'fs'
import DB from '@xrplmeta/common/lib/db.js'
import initRepo from '@xrplmeta/common/core/repo.js'
import { currencyHexToUTF8 } from '@xrplmeta/common/lib/xrpl.js'


console.log('parsing ledgers.csv')

let ledgers = fs.readFileSync('/Users/mwni/Documents/xrplv2/ledgers.csv')
	.toString()
	.split('\n')
	.slice(1)
	.map(line => ({
		index: parseInt(line.split(',')[0]),
		date: Date.parse(line.split(',')[1])/1000,
	}))

console.log('parsed', ledgers.length, 'ledger dates')



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
	let i = 0

	for(let date of dates){
		let stats = oldDB.all(`SELECT * FROM Stats WHERE date = ?`, date)
		let ledger = repo.get(`
			SELECT *, ABS("date" - ?) as dist FROM Ledgers
			WHERE dist <= 10
			ORDER BY dist
			LIMIT 1`,
			date
		)

		if(!ledger){
			ledger = ledgers.find(l => l.date === date)

			if(!ledger){
				console.log(':(', date)
				process.exit()
			}else{
				repo.ledgers.insert({
					index: ledger.index,
					date: ledger.date,
					txs: 0,
					trusts: 0,
					untrusts: 0,
					pays: 0,
					offers: 0,
					cancels: 0,
					fees: 0,
					accounts: 0
				})

				console.log('inserted ledger', ledger)
			}
		}

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
		
			if(repo.get(`SELECT * FROM Stats WHERE ledger = ? AND trustline = ?`, ledger.index, newTrustlineId)){
				repo.run(`UPDATE Stats SET supply=? WHERE ledger = ? AND trustline = ?`,
					stat.supply, ledger.index, newTrustlineId)

				console.log('update', newTrustlineId, stat.supply)
			}else{
				let row = {
					trustline: newTrustlineId,
					ledger: ledger.index,
					count: stat.accounts,
					supply: stat.supply,
					ask: '0',
					bid: '0'
				}

				repo.stats.insert(row)
				//console.log('insert', row)
			}

		}

		console.log(i++ / dates.length)
	}

})