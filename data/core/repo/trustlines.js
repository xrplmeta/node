export async function get(){
	return this.db.all(
		`SELECT 
			id,
			currency, 
			(SELECT address FROM Issuers WHERE Issuers.id = issuer) as issuer
		FROM Trustlines`, 
	)
}

export async function getOne(by, createIfNonExistent){
	if(by.currency && by.issuer){
		let issuer = await this.issuers.getOne({address: by.issuer}, createIfNonExistent)

		if(!issuer)
			return null

		let trustline = this.db.get(
			`SELECT * 
			FROM Trustlines 
			WHERE currency=? AND issuer=?`, 
			by.currency, issuer.id
		)

		if(!trustline && createIfNonExistent)
			trustline = await this.db.insert(
				'Trustlines',
				{
					currency: by.currency, 
					issuer: issuer.id
				}
			)

		return trustline
	}
}

export async function idFromCurrency(currency){
	return currency.currency !== 'XRP' 
		? (await this.trustlines.getOne(currency, true)).id
		: 0
}