export async function set({currency, issuer}, whales){
	let trustline = await this.trustlines.getOne({currency, issuer}, true)

	await this.db.run(`DELETE FROM Whales WHERE trustline = ?`, trustline.id)
	await this.db.insert(
		'Whales',
		whales.map(whale => ({
			trustline: trustline.id,
			address: whale.address,
			balance: whale.balance
		}))
	)
}