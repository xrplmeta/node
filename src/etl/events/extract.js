import { extractLedgerStats } from './scopes/ledgerstats.js'
import { extractTokenExchanges } from './scopes/exchanges.js'


export function extractEvents({ ctx, ledger }){
	extractLedgerStats({ ctx, ledger })
	extractTokenExchanges({ ctx, ledger })
}