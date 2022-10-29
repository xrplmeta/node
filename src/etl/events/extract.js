import { extractLedgerStats } from './scopes/ledgerstats.js'
import { extractTokenExchanges } from './scopes/tokenexchanges.js'
import { extractNFTokenExchanges } from './scopes/nftexchanges.js'


export function extractEvents({ ctx, ledger }){
	extractLedgerStats({ ctx, ledger })
	extractTokenExchanges({ ctx, ledger })
	extractNFTokenExchanges({ ctx, ledger })
}