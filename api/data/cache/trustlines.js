import { keySort, mapMultiKey, nestDotNotated } from '@xrplmeta/common/lib/data.js'
import { createURI as createPairURI } from '@xrplmeta/common/lib/pair.js'
import { wait } from '@xrplmeta/common/lib/time.js'
import Decimal from '@xrplmeta/common/lib/decimal.js'
import { log } from '@xrplmeta/common/lib/log.js'


export function init(){
	this.exec(
		`CREATE TABLE IF NOT EXISTS "Trustlines" (
			"id"			INTEGER NOT NULL UNIQUE,
			"currency"		TEXT NOT NULL,
			"issuer"		TEXT NOT NULL,
			"minimal"		TEXT NOT NULL,
			"full"			TEXT NOT NULL
		);
		
		CREATE INDEX IF NOT EXISTS 
		"TrustlinesCurrency" ON "Trustlines" 
		("currency");

		CREATE INDEX IF NOT EXISTS 
		"TrustlinesIssuer" ON "Trustlines" 
		("issuer");`
	)
}

export function get({currency, issuer}){
	return decode(this.get(
		`SELECT * FROM Trustlines
		WHERE currency = ? AND issuer = ?`,
		currency,
		issuer
	))
}

export function insert({id, currency, issuer, minimal, full}){
	this.insert({
		table: 'Trustlines',
		data: {
			id,
			currency,
			issuer,
			minimal: JSON.stringify(minimal),
			full: JSON.stringify(full),
		},
		duplicate: 'update'
	})
}

function decode(row){
	return {
		...row,
		minimal: JSON.parse(row.minimal),
		full: JSON.parse(row.full),
	}
}