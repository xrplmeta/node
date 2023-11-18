import { eq } from '@xrplkit/xfl'
import { readPoint, writePoint } from './common.js'


export function readBalance({ ctx, account, token, ledgerSequence }){
	return readPoint({
		table: ctx.db.core.accountBalances,
		selector: {
			account,
			token
		},
		ledgerSequence
	})
		?.balance
}

export function writeBalance({ ctx, account, token, ledgerSequence, balance }){
	return writePoint({
		table: ctx.db.core.accountBalances,
		selector: {
			account,
			token
		},
		ledgerSequence,
		backwards: ctx.backwards,
		data: !eq(balance, 0)
			? { balance }
			: null
	})
}