export async function all(){
	return this.all(
		`SELECT *
		FROM Issuers`, 
	)
}

export async function get(by, createIfNonExistent){
	if(by.address){
		let issuer = await this.get(
			`SELECT * 
			FROM Issuers 
			WHERE address = ?`, 
			by.address
		)

		if(!issuer && createIfNonExistent)
			issuer = await this.insert(
				'Issuers',
				{address: by.address}
			)

		return issuer
	}else if(by.id){
		return await this.get(
			`SELECT * 
			FROM Issuers 
			WHERE id = ?`, 
			by.id
		)
	}
}