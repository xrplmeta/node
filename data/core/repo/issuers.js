export async function getOne(by, createIfNonExistent){
	if(by.address){
		let issuer = await this.db.get(
			`SELECT * 
			FROM Issuers 
			WHERE address = ?`, 
			by.address
		)

		if(!issuer && createIfNonExistent)
			issuer = await this.db.insert(
				'Issuers',
				{address: by.address}
			)

		return issuer
	}else if(by.id){
		return await this.db.get(
			`SELECT * 
			FROM Issuers 
			WHERE id = ?`, 
			by.id
		)
	}
}