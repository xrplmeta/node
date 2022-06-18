import { rippleToUnix } from '@xrplkit/time'

export async function fetch({ ctx, sequence }){
	let { result } = await ctx.xrpl.request({ 
		command: 'ledger', 
		ledger_index: sequence,
		transactions: true,
		expand: true
	})

	return format(result.ledger)
}

export function format(ledger){
	return {
		sequence: parseInt(ledger.ledger_index),
		hash: ledger.ledger_hash,
		closeTime: rippleToUnix(ledger.close_time || ledger.ledger_time),
		transactions: ledger.transactions
	}
}