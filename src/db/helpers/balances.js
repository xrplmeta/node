import { eq } from '@xrplkit/xfl'
import { readPoint, writePoint, clearPoint } from '../../lib/datapoints.js'


export function readBalance({ ctx, account, token, ledgerSequence }){
	return readPoint({
		table: ctx.db.accountBalances,
		selector: {
			account,
			token
		},
		ledgerSequence
	})
		?.balance
}

export function writeBalance({ ctx, account, token, ledgerSequence, balance }){
	if(eq(balance, 0)){
		return clearPoint({
			table: ctx.db.accountBalances,
			selector: {
				account,
				token
			},
			ledgerSequence,
		})
	}else{
		return writePoint({
			table: ctx.db.accountBalances,
			selector: {
				account,
				token
			},
			ledgerSequence,
			data: {
				balance 
			}
		})
	}
}