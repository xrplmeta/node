export async function set(t, {currency, issuer}, distributions){
	let trustline = await this.trustlines.getOne({currency, issuer})

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