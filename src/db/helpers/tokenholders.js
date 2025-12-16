export function readTokenHolders({ ctx, token, ledgerSequence, offset = 0, limit = 100 }){
	return ctx.db.core.accountBalances.readManyRaw({
		query: 
			`SELECT Account.id, Account.address, AccountBalance.balance
			FROM AccountBalance
			JOIN Account ON (Account.id = AccountBalance.account)
			JOIN (
				SELECT account, MAX(ledgerSequence) as maxSequence
				FROM AccountBalance
				WHERE token = ?
				AND ledgerSequence <= ?
				GROUP BY account
			) latest 
				ON AccountBalance.account = latest.account
				AND AccountBalance.ledgerSequence = latest.maxSequence 	
			WHERE token = ?
			AND AccountBalance.balance > 0
			ORDER BY AccountBalance.balance DESC
			LIMIT ?, ?`,
		params: [
			token.id,
			ledgerSequence,
			token.id,
			offset,
			limit
		]
	})
		.map(({ id, address, balance }) => ({
			account: {
				id,
				address: ctx.db.core.accounts.struct.decodeField('address', address)
			},
			balance
		}))
}