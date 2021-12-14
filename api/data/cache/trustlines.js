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
			"full"			TEXT NOT NULL,
			"condensed"		TEXT NOT NULL,
			"accounts"		INTEGER NOT NULL,
			"marketcap"		REAL NOT NULL,
			"volume"		REAL NOT NULL
		);
		
		CREATE INDEX IF NOT EXISTS 
		"TrustlinesCurrency" ON "Trustlines" 
		("currency");

		CREATE INDEX IF NOT EXISTS 
		"TrustlinesIssuer" ON "Trustlines" 
		("issuer");

		CREATE INDEX IF NOT EXISTS 
		"TrustlinesAccounts" ON "Trustlines" 
		("accounts");

		CREATE INDEX IF NOT EXISTS 
		"TrustlinesMarketcap" ON "Trustlines" 
		("marketcap");

		CREATE INDEX IF NOT EXISTS 
		"TrustlinesVolume" ON "Trustlines" 
		("volume");`
	)
}

export function all({currency, minAccounts, limit}, full){
	let rows

	if(currency){
		rows = this.all(
			`SELECT id, currency, issuer, ${full ? 'full' : 'condensed'} as meta FROM Trustlines
			WHERE currency = ?
			AND accounts >= ?
			ORDER BY volume DESC
			LIMIT ?`,
			currency,
			minAccounts || 0,
			limit || 999999999
		)
	}

	return rows.map(row => decode(row))
}


export function get({currency, issuer}, full){
	return decode(this.get(
		`SELECT id, currency, issuer, ${full ? 'full' : 'condensed'} as meta FROM Trustlines
		WHERE currency = ? AND issuer = ?`,
		currency,
		issuer
	))
}

export function insert({id, currency, issuer, full, condensed}){
	this.insert({
		table: 'Trustlines',
		data: {
			id,
			currency,
			issuer,
			full: JSON.stringify(full),
			condensed: JSON.stringify(condensed),
			accounts: full.stats.trustlines,
			marketcap: parseFloat(full.stats.marketcap),
			volume: parseFloat(full.stats.volume),
		},
		duplicate: 'update'
	})
}

function decode(row){
	let { meta, ...trustline } = row

	return {
		...trustline,
		...JSON.parse(meta)
	}
}