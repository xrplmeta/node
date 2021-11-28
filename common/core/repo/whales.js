export async function insert({currency, issuer}, whales){
	let trustline = await this.trustlines.require({currency, issuer})

	await this.run(`DELETE FROM Whales WHERE trustline = ?`, trustline.id)
	await this.insert(
		'Whales',
		whales.map(whale => ({
			trustline: trustline.id,
			address: whale.address,
			balance: whale.balance
		}))
	)
}