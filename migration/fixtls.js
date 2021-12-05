import DB from '@xrplmeta/common/lib/db.js'
import initRepo from '@xrplmeta/common/core/repo.js'
import { currencyHexToUTF8 } from '@xrplmeta/common/lib/xrpl.js'



let repo = initRepo({
	data: {
		dir: '/Users/mwni/Documents/xrplv2'
	}
})


let tls = repo.trustlines.all()
let i = 0

console.log(tls.length, 'trustlines')

repo.tx(() => {
	for(let tl of tls){
		if(typeof tl.issuer !== 'number'){
			console.log('fixing', tl.currency)

			let issuerId = repo.accounts.id(tl.issuer)
			let existing = repo.trustlines.get({currency: tl.currency, issuer: issuerId})

			if(existing){
				console.log('fuck', existing)

				repo.run(`UPDATE Distributions SET trustline = ? WHERE trustline = ?`, existing.id, tl.id)
				repo.run(`UPDATE Stats SET trustline = ? WHERE trustline = ?`, existing.id, tl.id)
				repo.run(`UPDATE Exchanges SET base = ? WHERE base = ?`, existing.id, tl.id)
				repo.run(`UPDATE Exchanges SET quote = ? WHERE quote = ?`, existing.id, tl.id)
				repo.run(`UPDATE Metas SET subject = ? WHERE type = ? AND subject = ?`, existing.id, 'T', tl.id)
				repo.run(`DELETE FROM Trustlines WHERE id = ?`, tl.id)
			}else{

				repo.run(`UPDATE Trustlines SET issuer=? WHERE id=?`, issuerId, tl.id)
			}

			
		}
	}
})