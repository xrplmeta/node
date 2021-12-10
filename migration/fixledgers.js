import fs from 'fs'
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


let repo = initRepo({
	data: {
		dir: '/Users/mwni/Documents/xrplv2'
	}
})


let dates = repo.allv(`SELECT DISTINCT ledger FROM Stats WHERE ledger > ?`, 1000000000)

console.log('got', dates.length, 'ledgers to fix')

repo.tx(() => {
	let i = 0

	for(let date of dates){
		let ledger = repo.get(`
			SELECT *, ABS("date" - ?) as dist FROM Ledgers
			WHERE dist <= 10
			ORDER BY dist
			LIMIT 1`,
			date
		)

		if(ledger){
			console.log('got ledger entry in mean time:', date, ledger.index)
			console.log(repo.run(
				`UPDATE Stats
				SET ledger = ?
				WHERE ledger =?`,
				ledger.index,
				date
			))
		}
	}
})