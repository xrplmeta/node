export async function set(t, trustlines, replaceAfter){
	for(let trustline of trustlines){
		Object.assign(trustline, await this.trustlines.getOne(trustline, true))
	}

	if(replaceAfter){
		for(let { id } of trustlines){
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
			trustline: trustline.id,
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

export async function get(trustline){
	trustline = await this.trustlines.getOne(trustline)

	return await this.db.all(
		`SELECT *
		FROM Stats
		WHERE trustline = ?
		ORDER BY date ASC`,
		trustline.id
	)
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