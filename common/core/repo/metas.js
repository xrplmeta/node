import { wait } from '../../lib/time.js'

export async function get(type, subject){
	return await this.db.all(
		`SELECT key, value, source
		FROM Metas
		WHERE type = ? AND subject = ? AND value NOT NULL`,
		type, subject
	)
}

export async function getOne(type, subject, key, source){
	let metas = await this.db.all(
		`SELECT value, source
		FROM Metas
		WHERE type = ? AND subject = ? AND key = ?`,
		type, subject, key
	)

	if(metas.length === 0)
		return undefined

	if(source)
		return metas.find(meta => meta.source === source)

	return metas[0].value
}

export async function setOne(meta){
	await this.metas.set([meta])
}

export async function set(metas){
	let rows = []

	for(let meta of metas){
		if(!meta.meta)
			continue

		if(typeof meta.subject !== 'number'){
			switch(meta.type){
				case 'issuer':
					meta.subject = (await this.issuers.getOne({address: meta.subject}, true)).id
					break
				case 'trustline':
					meta.subject = (await this.trustlines.getOne(meta.subject, true)).id
					break
			}
		}

		for(let [key, value] of Object.entries(meta.meta)){
			rows.push({
				type: meta.type,
				subject: meta.subject,
				source: meta.source,
				key,
				value,
			})
		}
	}

	await this.db.insert(
		'Metas',
		rows,
		{
			duplicate: {
				keys: ['type', 'subject', 'key', 'source'],
				replace: true
			}
		}
	)
}