export async function set(t, {currency, issuer}, distributions, replaceAfter){
	let trustline = await this.trustlines.getOne({currency, issuer})

	if(replaceAfter){
		await this.db.run(
			`DELETE FROM Distributions
			WHERE trustline = ?
			AND date > ?`,
			trustline.id,
			replaceAfter
		)
	}

	await this.db.insert(
		'Distributions',
		distributions.map(distribution => ({
			trustline: trustline.id,
			date: t,
			percent: distribution.percent,
			share: distribution.share
		})),
		{
			duplicate: {
				keys: ['trustline', 'date', 'percent'],
				update: true
			}
		}
	)
}