import fs from 'fs'
import initRepo from '@xrplmeta/common/core/repo.js'
import { currencyHexToUTF8 } from '@xrplmeta/common/lib/xrpl.js'


let repo = initRepo({
	data: {
		dir: '/Users/mwni/Documents/xrpl'
	}
})
//66129415

let interval = 3600
let start = Math.floor(67899600 / interval) * interval
let end = 67917600
let trustlines = repo.trustlines.all()

repo.tx(() => {

	for(let trustline of trustlines){
		console.log(trustline.currency, trustlines.indexOf(trustline) / trustlines.length)

		for(let i=start; i<end; i+=interval){
			let closest = repo.get(`
				SELECT *, ABS("ledger" - ?) as dist FROM Stats
				WHERE trustline = ? AND ledger != ?
				ORDER BY dist
				LIMIT 1`,
				i,
				trustline.id,
				i
			)

			if(!closest)
				continue

			delete closest.id
			delete closest.dist

			let existing = repo.get(`SELECT * FROM Stats WHERE trustline = ? AND ledger = ?`, trustline.id, i)

			if(existing){
				repo.run(`UPDATE Stats SET supply=? WHERE id=?`, closest.supply, existing.id)
				//console.log('updated')
			}else{
				repo.insert({
					table: 'Stats',
					data: {
						...closest,
						ledger: i
					}
				})
			}
		}

		for(let i=start; i<end; i+=interval){
			let closest = repo.get(`
				SELECT *, ABS("ledger" - ?) as dist FROM Distributions
				WHERE trustline = ? AND ledger != ?
				ORDER BY dist
				LIMIT 1`,
				i,
				trustline.id,
				i
			)

			if(!closest || closest.dist > 3600)
				continue

			delete closest.id
			delete closest.dist

			
			repo.insert({
				table: 'Distributions',
				data: {
					...closest,
					ledger: i
				},
				duplicate: 'ignore'
			})
		}
	}
})

console.log('cleaning off grid stats...')
repo.exec(`DELETE FROM Stats WHERE ledger % 3600 != 0`)

console.log('cleaning off grid distribs...')
repo.exec(`DELETE FROM Distributions WHERE ledger % 3600 != 0`)

console.log('all done')