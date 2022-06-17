import { rippleToUnix } from '@xrplkit/time'

export async function fetch({ ctx, sequence }){
	let { result } = await ctx.xrpl.request({ 
		command: 'ledger', 
		ledger_index: sequence,
		transactions: true,
		expand: true
	})

	return {
		sequence: parseInt(result.ledger.ledger_index),
		hash: result.ledger.ledger_hash,
		closeTime: rippleToUnix(result.ledger.close_time),
		transactions: result.ledger.transactions
	}
}