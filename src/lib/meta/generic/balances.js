import { eq } from '@xrplkit/xfl'
import { write as writeSimple, read as readSimple } from '../simple.js'

export function write({ ctx, account, token, ledgerSequence, balance }){
	writeSimple({
		ctx,
		table: 'accountBalances',
		where: {
			account,
			token
		},
		ledgerSequence,
		item: { balance },
		compare: (a, b) => eq(a?.value || '0', b?.value || '0')
	})
}

export function read({ ctx, account, token, ledgerSequence }){
	return readSimple({
		ctx,
		table: 'accountBalances',
		where: {
			account,
			token
		},
		ledgerSequence
	})
}