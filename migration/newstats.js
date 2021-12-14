import DB from '@xrplmeta/common/lib/db.js'
import initRepo from '@xrplmeta/common/backend/repo.js'
import { currencyHexToUTF8 } from '@xrplmeta/common/lib/xrpl.js'



let repo = initRepo({
	ledger: {
		topPercenters: [0.01, 0.1, 1.0, 10.0, 25.0, 50.0]
	},
	data: {
		dir: 'V:/xrpl/xrplmeta'
	}
})


console.log('fixing coverage labels')

repo.exec(`UPDATE Coverages SET task='ledgertx' WHERE task='ledger.txs'`)
repo.exec(`UPDATE Coverages SET task='snapshot' WHERE task='ledger.states'`)

let stats = repo.all(`SELECT * FROM Stats`)

console.log(`got all ${stats.length} stats`)

repo.exec(`DROP TABLE Stats`)
repo.stats.init()

repo.tx(() => {
	for(let stat of stats){
		let distribs = repo.all(`SELECT * FROM Distributions WHERE trustline = ? AND ledger = ?`, stat.trustline, stat.ledger)

		for(let { percent, share } of distribs){
			stat[`percent${percent.toString().replace('.', '')}`] = share
		}

		repo.insert({
			table: 'Stats',
			data: stat
		})

		console.log(stats.indexOf(stat), stats.length)
	}
})