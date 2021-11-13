export async function set(t, trustlines, replaceAfter){
	let issuerRows = await this.db.insert(
		'Issuers',
		trustlines.map(trustline => ({
			address: trustline.issuer
		})),
		{
			duplicate: {ignore: true}
		}
	)

	let trustlineRows = await this.db.insert(
		'Trustlines',
		trustlines.map((trustline, i) => ({
			currency: trustline.currency,
			issuer: issuerRows[i].id
		})),
		{
			duplicate: {ignore: true}
		}
	)

	if(replaceAfter){
		for(let {id} of trustlineRows){
			await this.db.run(
				`DELETE FROM Stats
				WHERE trustline = ?
				AND date > ?`,
				id,
				replaceAfter
			)
		}
	}

	await this.db.insert(
		'Stats',
		trustlines.map((trustline, i) => ({
			date: t,
			trustline: trustlineRows[i].id,
			accounts: trustline.accounts,
			supply: trustline.supply,
			buy: trustline.buy,
			sell: trustline.sell,
		})),
		{
			duplicate: {
				keys: ['trustline', 'date'], 
				update: true
			}
		}

	)
}

export async function get(trustline, start, end){
	return 0
}


export async function getRecent(trustline, t){
	if(t === undefined){
		return await this.db.get(
			`SELECT *
			FROM Stats
			WHERE trustline = ?
			ORDER BY date DESC`,
			trustline.id
		)
	}else{
		let gridT = Math.floor(t / this.config.ledger.historyInterval) * this.config.ledger.historyInterval

		return await this.db.get(
			`SELECT *
			FROM Stats
			WHERE trustline = ?
			AND date >= ?
			ORDER BY date ASC`,
			trustline.id,
			gridT
		)
	}
	
}