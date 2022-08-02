import { readLedgerAt } from '../../db/helpers/ledgers.js'


export function serveLedger(){
	return ({ ctx, sequence, time }) => {
		let ledger = readLedgerAt({ 
			ctx, 
			sequence, 
			time
		})

		if(!ledger){
			throw {
				type: `notFound`,
				message: `This server has no record of such a ledger. Check the available range using "server_info".`,
				expose: true
			}
		}

		return {
			sequence: ledger.sequence,
			hash: ledger.hash,
			close_time: ledger.closeTime,
			tx_count: ledger.txCount,
			fee_min: ledger.minFee,
			fee_max: ledger.maxFee,
			fee_avg: ledger.avgFee
		}
	}
}